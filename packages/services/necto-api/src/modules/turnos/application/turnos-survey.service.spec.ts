import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdministratorRequiredError, SurveyClosedError, SurveyNotFoundError, TurnosInvalidError, ViewNotAllowedError } from '../domain/errors';
import { LAURA, MATEO, SOFIA, operationWorld } from '../fakes.spec';

type World = Awaited<ReturnType<typeof operationWorld>>;
const config = (extra: Record<string, unknown> = {}) => ({
  enabled: true,
  channels: { email: true, whatsapp: false },
  question: '¿Cómo te atendimos?',
  allowComment: true,
  thanksMessage: 'Gracias',
  validHours: 24,
  ...extra,
});
const tokenFrom = (world: World, index = -1) => {
  const text = world.transport.sent.at(index)!.text;
  return /survey\/([A-Za-z0-9_-]+)/.exec(text)![1];
};
/** Serves one customer of the manual queue and waits for the invitation to be sent. */
async function serve(world: World, customer: Record<string, unknown> = { customerName: 'Ana Pérez', customerEmail: 'ana@x.co' }, email = LAURA, queue = world.recogida.id) {
  const ticket = await world.issue(queue, customer, email);
  const scope = await world.operator(email);
  await world.ticketService.call(scope, ticket.id);
  await world.ticketService.complete(scope, ticket.id);
  await world.surveys.drain();
  return ticket;
}

describe('the survey settings', () => {
  it('are saved by the administrator only, and validated field by field', async () => {
    const world = await operationWorld();
    await assert.rejects(world.settings.saveSurvey(await world.operator(LAURA), config()), AdministratorRequiredError);
    await assert.rejects(world.settings.saveSurvey(await world.admin(), config({ question: 'x', channels: { email: 'sí' }, validHours: 0, queueIds: ['ghost'], thanksMessage: 'x'.repeat(300) })), (error: unknown) =>
      error instanceof TurnosInvalidError && ['question', 'channels.email', 'validHours', 'queueIds', 'thanksMessage'].every((field) => Boolean(error.fields[field])),
    );
    const saved = await world.settings.saveSurvey(await world.admin(), config({ queueIds: [world.recogida.id] }));
    assert.deepEqual([saved.enabled, saved.queueIds, saved.validHours], [true, [world.recogida.id], 24]);
  });
  it('start switched off, so nobody is surveyed until the administrator decides', async () => {
    const world = await operationWorld();
    const { survey } = (await world.service.get('a'.repeat(24))).configuration;
    assert.deepEqual([survey.enabled, survey.channels, survey.queueIds], [false, { email: true, whatsapp: false }, null]);
  });
});

describe('sending the invitation', () => {
  it('invites the customer when a turn is completed, by the mail the platform has, and says only that the provider accepted it', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    await serve(world);
    assert.equal(world.transport.sent.length, 1);
    assert.equal(world.transport.sent[0].to, 'ana@x.co');
    assert.ok(world.transport.sent[0].text.includes('¿Cómo te atendimos?') && world.transport.sent[0].text.includes('/turnos/survey/'));
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.delivery.email.status, invitation.delivery.whatsapp.status, invitation.response], ['accepted', 'not-requested', null]);
    assert.ok(!JSON.stringify(invitation).includes(tokenFrom(world)), 'only a hash of the link is kept');
  });
  it('does nothing when the survey is off or the queue is not one of the selected', async () => {
    const world = await operationWorld();
    await serve(world);
    assert.equal(world.surveyRepository.items.size, 0);
    await world.settings.saveSurvey(await world.admin(), config({ queueIds: [world.caja.id] }));
    await serve(world, { customerEmail: 'b@x.co' });
    assert.deepEqual([world.surveyRepository.items.size, world.transport.sent.length], [0, 0]);
  });
  it('records that there is no mail provider instead of pretending it was sent', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    world.transport.failWith = 'not-configured';
    await serve(world);
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.delivery.email.status, invitation.delivery.email.failureCode, world.transport.sent.length], ['not-configured', null, 0]);
  });
  it('records a provider failure with its code, never the address', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    world.transport.failWith = 'timeout';
    await serve(world);
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.delivery.email.status, invitation.delivery.email.failureCode], ['failed', 'timeout']);
    assert.ok(!JSON.stringify(invitation.delivery).includes('ana@x.co'));
  });
  it('says "no contact" when the customer left no email or phone', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config({ channels: { email: true, whatsapp: true } }));
    await serve(world, { customerName: 'Sin datos' });
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.delivery.email.status, invitation.delivery.whatsapp.status, world.transport.sent.length], ['no-contact', 'no-contact', 0]);
  });
  it('WhatsApp has no provider: it is always recorded as not configured, and no mail is sent for it', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config({ channels: { email: false, whatsapp: true } }));
    await serve(world, { customerName: 'Ana', customerPhone: '+573001234567', customerEmail: 'ana@x.co' });
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.delivery.email.status, invitation.delivery.whatsapp.status, world.transport.sent.length], ['not-requested', 'not-configured', 0]);
  });
  it('one invitation per turn, even if the turn is completed twice', async () => {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    const ticket = await serve(world);
    await world.ticketService.complete(await world.operator(LAURA), ticket.id);
    await world.surveys.drain();
    assert.deepEqual([world.surveyRepository.items.size, world.transport.sent.length], [1, 1]);
  });
});

describe('the customer answers', () => {
  async function invited() {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    await serve(world);
    return { world, token: tokenFrom(world) };
  }
  it('opens the link and sees the question, never anything of other customers', async () => {
    const { world, token } = await invited();
    const page = await world.surveys.open(token);
    assert.deepEqual([page.businessName, page.queueName, page.question, page.allowComment, page.closed], ['Café Central', 'Recogida de pedidos', '¿Cómo te atendimos?', true, false]);
    assert.ok(!JSON.stringify(page).includes('Ana'));
  });
  it('saves a rating and a comment once, and a second answer is refused', async () => {
    const { world, token } = await invited();
    const thanks = await world.surveys.respond(token, { rating: 5, comment: '  Muy buena atención ' });
    assert.equal(thanks.thanksMessage, 'Gracias');
    const [invitation] = [...world.surveyRepository.items.values()];
    assert.deepEqual([invitation.response?.rating, invitation.response?.comment], [5, 'Muy buena atención']);
    await assert.rejects(world.surveys.respond(token, { rating: 1 }), SurveyClosedError);
    assert.equal([...world.surveyRepository.items.values()][0].response?.rating, 5, 'the first answer stays');
    assert.equal((await world.surveys.open(token)).closed, 'answered');
  });
  it('two answers sent at the same moment: one is kept', async () => {
    const { world, token } = await invited();
    const results = await Promise.allSettled([world.surveys.respond(token, { rating: 4 }), world.surveys.respond(token, { rating: 2 }), world.surveys.respond(token, { rating: 3 })]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  });
  it('refuses a rating that is not 1 to 5, a comment where there is none, and a link that does not exist', async () => {
    const { world, token } = await invited();
    for (const rating of [0, 6, 2.5, '5' as never]) await assert.rejects(world.surveys.respond(token, { rating }), TurnosInvalidError);
    await world.settings.saveSurvey(await world.admin(), config({ allowComment: false }));
    await assert.rejects(world.surveys.respond(token, { rating: 5, comment: 'hola' }), TurnosInvalidError);
    await assert.rejects(world.surveys.respond('x'.repeat(43), { rating: 5 }), SurveyNotFoundError);
    await assert.rejects(world.surveys.open('short'), SurveyNotFoundError);
    assert.deepEqual([...world.surveyRepository.items.values()].map((item) => item.response), [null]);
  });
  it('the link expires', async () => {
    const { world, token } = await invited();
    world.clock.advance(25 * 3_600_000);
    assert.equal((await world.surveys.open(token)).closed, 'expired');
    await assert.rejects(world.surveys.respond(token, { rating: 5 }), SurveyClosedError);
  });
  it('tells the live connections that an answer arrived, in the queue it is about', async () => {
    const { world, token } = await invited();
    const seen: Array<[string, string | null]> = [];
    world.hub.subscribe('a'.repeat(24), (event) => seen.push([event.type, event.queueId]));
    await world.surveys.respond(token, { rating: 5 });
    assert.deepEqual(seen, [['survey.answered', world.recogida.id]]);
  });
});

describe('the satisfaction numbers', () => {
  async function answered() {
    const world = await operationWorld();
    await world.settings.saveSurvey(await world.admin(), config());
    const give = async (rating: number, email = LAURA, queue = world.recogida.id, customer = `c${world.transport.sent.length}@x.co`) => {
      world.clock.advance(60_000);
      await serve(world, { customerEmail: customer }, email, queue);
      await world.surveys.respond(tokenFrom(world), { rating, comment: `Nota ${rating}` });
    };
    await give(5);
    await give(4);
    world.clock.advance(24 * 3_600_000);
    await give(2, MATEO);
    await serve(world, { customerEmail: 'sin-respuesta@x.co' });
    await give(3, LAURA, world.caja.id);
    return { world, give };
  }
  it('are null with nothing answered, not zero', async () => {
    const world = await operationWorld();
    const { analytics } = await world.surveys.analytics(await world.admin(), {});
    assert.deepEqual([analytics.overall.average, analytics.overall.satisfied, analytics.overall.responseRate, analytics.overall.responses], [null, null, null, 0]);
    assert.deepEqual(analytics.trend.map((point) => point.average), [null]);
  });
  it('average, distribution, satisfaction and response rate come from the real answers', async () => {
    const { world } = await answered();
    const { analytics } = await world.surveys.analytics(await world.admin(), { preset: '7d' });
    const { overall } = analytics;
    assert.deepEqual([overall.invited, overall.responses, overall.average, overall.satisfied, overall.responseRate], [5, 4, 3.5, 50, 80]);
    assert.deepEqual(overall.distribution, { '1': 0, '2': 1, '3': 1, '4': 1, '5': 1 });
  });
  it('a trend with one point per day, empty days included', async () => {
    const { world } = await answered();
    const { analytics } = await world.surveys.analytics(await world.admin(), { preset: '7d' });
    assert.equal(analytics.trend.length, 7);
    assert.deepEqual(analytics.trend.filter((point) => point.responses > 0).map((point) => [point.day, point.responses, point.average]), [['2026-03-04', 2, 4.5], ['2026-03-05', 2, 2.5]]);
  });
  it('by queue and by operator, for the administrator', async () => {
    const { world } = await answered();
    const { analytics } = await world.surveys.analytics(await world.admin(), { preset: '7d' });
    assert.deepEqual(analytics.byQueue.map((row) => [row.queueName, row.responses, row.average]), [['Pedidos en caja', 1, 3], ['Recogida de pedidos', 3, 3.67]]);
    assert.deepEqual(analytics.byOperator.map((row) => [row.operatorName, row.responses, row.average]), [['Laura Gómez', 3, 4], ['Mateo Ríos', 1, 2]]);
    const one = await world.surveys.analytics(await world.admin(), { preset: '7d', operatorId: (await world.operator(MATEO)).operator!.id });
    assert.deepEqual(one.analytics.overall.responses, 1);
  });
  it('an operator with the surveys view sees only their queues, and from the operators only themselves', async () => {
    const { world } = await answered();
    const sofia = await world.surveys.analytics(await world.operator(SOFIA), { preset: '7d' });
    assert.deepEqual(sofia.analytics.byQueue.map((row) => row.queueName), ['Pedidos en caja'], 'she works only in the automatic queue');
    assert.deepEqual([sofia.analytics.overall.responses, sofia.analytics.byOperator], [1, []], 'the answer of the cashier is about Laura, not about her');
    const responses = await world.surveys.responses(await world.operator(SOFIA), {});
    assert.deepEqual(responses.items.map((item) => item.queueId), [world.caja.id]);
  });
  it('an operator without the surveys view gets nothing, and asking for another queue is refused', async () => {
    const { world } = await answered();
    await assert.rejects(world.surveys.analytics(await world.operator(MATEO), {}), ViewNotAllowedError);
    await assert.rejects(world.surveys.responses(await world.operator(MATEO), {}), ViewNotAllowedError);
    await assert.rejects(world.surveys.analytics(await world.operator(SOFIA), { queueId: world.recogida.id }), TurnosInvalidError);
  });
  it('lists the answers newest first, with filters and pages, and refuses a wrong rating or page', async () => {
    const { world } = await answered();
    const admin = await world.admin();
    const all = await world.surveys.responses(admin, {});
    assert.deepEqual([all.total, all.items[0].response?.comment], [4, 'Nota 3']);
    assert.deepEqual((await world.surveys.responses(admin, { rating: 5 })).items.map((item) => item.response?.rating), [5]);
    assert.deepEqual((await world.surveys.responses(admin, { pageSize: 1, page: 2 })).items.length, 1);
    assert.deepEqual((await world.surveys.responses(admin, { queueId: world.caja.id })).total, 1);
    await assert.rejects(world.surveys.responses(admin, { rating: 9 }), TurnosInvalidError);
    await assert.rejects(world.surveys.responses(admin, { page: 0 }), TurnosInvalidError);
  });
});
