import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import mongoose, { type Model } from 'mongoose';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { TurnosConfigurationStore } from '../application/turnos-configuration.store';
import { TurnosRealtimeHub } from '../application/turnos-realtime.hub';
import { TurnosAccessService } from '../application/turnos-access.service';
import { TurnosConfigurationService } from '../application/turnos-configuration.service';
import { TurnosTicketService } from '../application/turnos-ticket.service';
import { hashSurveyToken, newSurveyToken, type SurveyInvitation } from '../domain/survey';
import { ticketCode, type Ticket, type TicketActor } from '../domain/ticket';
import { aBusiness, FakeBusinessDirectory, InMemoryTurnosConfigurationRepository, operatorInput, RecordingTransport } from '../fakes.spec';
import { InMemorySurveyRepository } from '../operation-fakes.spec';
import { TurnosSurveyService } from '../application/turnos-survey.service';
import { MongoSurveyRepository } from './mongo-survey.repository';
import { MongoTicketRepository } from './mongo-ticket.repository';
import { MongoTurnosConfigurationRepository } from './mongo-turnos-configuration.repository';
import { SurveyRecord, SurveySchema } from './survey.schema';
import { TicketCounterRecord, TicketCounterSchema, TicketRecord, TicketSchema } from './ticket.schema';
import { TurnosConfigurationRecord, TurnosConfigurationSchema } from './turnos-configuration.schema';

/**
 * The operation of Turnos against a REAL MongoDB: what only the database can prove (that numbers, calls and answers hold when requests
 * arrive together). Runs only when `NECTO_TEST_MONGODB_URI` is set; every document it creates carries a random business id of its own and is
 * deleted at the end, and nothing else is read or deleted.
 */
const URI = process.env.NECTO_TEST_MONGODB_URI;
const NOW = new Date('2026-03-04T15:00:00.000Z');
const operator = (id: string): TicketActor => ({ operatorId: id, name: `Operador ${id}` });

describe('Turnos operation (real MongoDB)', { skip: URI ? false : 'set NECTO_TEST_MONGODB_URI to run it' }, () => {
  let tickets: MongoTicketRepository;
  let surveys: MongoSurveyRepository;
  let ticketModel: Model<TicketRecord>;
  let counterModel: Model<TicketCounterRecord>;
  let surveyModel: Model<SurveyRecord>;
  let configModel: Model<TurnosConfigurationRecord>;
  const used: string[] = [];
  const newBusiness = () => {
    const id = `test-${randomUUID()}`;
    used.push(id);
    return id;
  };
  let sequence = 0;
  const ticket = (businessId: string, extra: Partial<Ticket> = {}): Ticket => {
    sequence += 1;
    return {
      id: randomUUID(),
      businessId,
      queueId: 'q1',
      queueName: 'Caja',
      dayKey: '2026-03-04',
      prefix: 'C',
      number: sequence,
      code: ticketCode('C', sequence),
      seq: sequence,
      status: 'waiting',
      customer: { name: null, phone: null, email: null },
      answers: [],
      note: null,
      createdAt: new Date(NOW.getTime() + sequence * 1000),
      createdBy: operator('creator'),
      attendedBy: null,
      calledAt: null,
      finishedAt: null,
      cancelReason: null,
      events: [{ type: 'created', at: NOW, by: operator('creator') }],
      clientRequestId: null,
      ...extra,
    };
  };
  const put = async (businessId: string, extra: Partial<Ticket> = {}) => {
    const result = await tickets.insert(ticket(businessId, extra));
    assert.equal(result.kind, 'inserted');
    return (result as { ticket: Ticket }).ticket;
  };
  before(async () => {
    await mongoose.connect(URI!, { serverSelectionTimeoutMS: 5000 });
    ticketModel = mongoose.model(TicketRecord.name, TicketSchema) as unknown as Model<TicketRecord>;
    counterModel = mongoose.model(TicketCounterRecord.name, TicketCounterSchema) as unknown as Model<TicketCounterRecord>;
    surveyModel = mongoose.model(SurveyRecord.name, SurveySchema) as unknown as Model<SurveyRecord>;
    configModel = mongoose.model(TurnosConfigurationRecord.name, TurnosConfigurationSchema) as unknown as Model<TurnosConfigurationRecord>;
    await Promise.all([ticketModel.init(), counterModel.init(), surveyModel.init(), configModel.init()]);
    tickets = new MongoTicketRepository(ticketModel, counterModel);
    surveys = new MongoSurveyRepository(surveyModel);
  });
  after(async () => {
    if (used.length > 0) {
      await ticketModel.deleteMany({ businessId: { $in: used } });
      await surveyModel.deleteMany({ businessId: { $in: used } });
      await configModel.deleteMany({ businessId: { $in: used } });
      await counterModel.deleteMany({ _id: { $in: used.flatMap((id) => [new RegExp(`^${id}:`)]) } });
    }
    await mongoose.disconnect();
  });

  describe('the numbering', () => {
    it('gives different numbers to 100 requests made at the same moment, with no gaps', async () => {
      const business = newBusiness();
      const given = await Promise.all(Array.from({ length: 100 }, () => tickets.nextNumber(business, '2026-03-04', 'C')));
      assert.deepEqual(given.map((item) => item.number).sort((a, b) => a - b), Array.from({ length: 100 }, (_, index) => index + 1));
      assert.equal(new Set(given.map((item) => item.seq)).size, 100);
    });
    it('keeps each prefix and each scope on its own count', async () => {
      const business = newBusiness();
      const [c1, p1, c2, other] = [await tickets.nextNumber(business, 'd1', 'C'), await tickets.nextNumber(business, 'd1', 'P'), await tickets.nextNumber(business, 'd1', 'C'), await tickets.nextNumber(business, 'd2', 'C')];
      assert.deepEqual([c1.number, p1.number, c2.number, other.number], [1, 1, 2, 1]);
      assert.equal((await tickets.nextNumber(business, 'd1', '')).number, 1, 'no prefix counts as its own');
    });
    it('a business never touches the count of another', async () => {
      const [a, b] = [newBusiness(), newBusiness()];
      await Promise.all([tickets.nextNumber(a, 'x', 'C'), tickets.nextNumber(a, 'x', 'C')]);
      assert.equal((await tickets.nextNumber(b, 'x', 'C')).number, 1);
    });
  });

  describe('creating', () => {
    it('refuses a code that already exists that day in that business, but not in another day or business', async () => {
      const business = newBusiness();
      await put(business, { code: 'C-900', dayKey: '2026-03-04' });
      assert.equal((await tickets.insert(ticket(business, { code: 'C-900', dayKey: '2026-03-04' }))).kind, 'duplicate-code');
      assert.equal((await tickets.insert(ticket(business, { code: 'C-900', dayKey: '2026-03-05' }))).kind, 'inserted');
      assert.equal((await tickets.insert(ticket(newBusiness(), { code: 'C-900', dayKey: '2026-03-04' }))).kind, 'inserted');
    });
    it('answers the turn that already exists to a repeated clientRequestId', async () => {
      const business = newBusiness();
      const first = await put(business, { clientRequestId: 'request-aaaa' });
      const again = await tickets.insert(ticket(business, { clientRequestId: 'request-aaaa' }));
      assert.deepEqual([again.kind, (again as { ticket: Ticket }).ticket.id], ['duplicate-request', first.id]);
      assert.equal((await tickets.insert(ticket(newBusiness(), { clientRequestId: 'request-aaaa' }))).kind, 'inserted', 'another business may use the same id');
    });
    it('stores and returns the whole turn unchanged, answers and history included', async () => {
      const business = newBusiness();
      const stored = await put(business, {
        customer: { name: 'Ana', phone: '+573001234567', email: 'ana@x.co' },
        answers: [{ fieldId: 'doc', label: 'Documento', type: 'text', value: '123' }, { fieldId: 'age', label: 'Edad', type: 'number', value: 31 }, { fieldId: 'ok', label: 'Acepta', type: 'checkbox', value: true }],
        note: 'Nota',
      });
      assert.deepEqual(await tickets.findById(business, stored.id), stored);
      assert.equal(await tickets.findById(newBusiness(), stored.id), null, 'not from another business');
    });
  });

  describe('calling and finishing, under concurrency', () => {
    it('ten operators calling the same turn at once: exactly one gets it', async () => {
      const business = newBusiness();
      const waiting = await put(business);
      const results = await Promise.all(Array.from({ length: 10 }, (_, index) => tickets.call(business, waiting.id, operator(`op${index}`), null, NOW, false)));
      assert.equal(results.filter((result) => result.kind === 'called').length, 1);
      assert.equal(results.filter((result) => result.kind === 'not-waiting').length, 9);
      const stored = (await tickets.findById(business, waiting.id))!;
      assert.equal(stored.events.filter((event) => event.type === 'called').length, 1);
    });
    it('ten operators taking the next turn at once get ten different turns, in order of arrival', async () => {
      const business = newBusiness();
      const waiting = [];
      for (let index = 0; index < 10; index++) waiting.push(await put(business));
      const results = await Promise.all(Array.from({ length: 10 }, (_, index) => tickets.callNext(business, 'q1', operator(`op${index}`), NOW, false)));
      assert.ok(results.every((result) => result.kind === 'called'));
      assert.deepEqual(new Set(results.map((result) => (result as { ticket: Ticket }).ticket.id)), new Set(waiting.map((item) => item.id)));
      assert.equal((await tickets.callNext(business, 'q1', operator('late'), NOW, false)).kind, 'empty');
    });
    it('takes the oldest first', async () => {
      const business = newBusiness();
      const [first, second] = [await put(business), await put(business)];
      const called = await tickets.callNext(business, 'q1', operator('a'), NOW, true);
      assert.equal((called as { ticket: Ticket }).ticket.id, first.id);
      assert.equal((called as { ticket: Ticket }).ticket.events.at(-1)?.automatic, true);
      assert.equal((await tickets.head(business, 'q1'))?.id, second.id);
    });
    it('one operator calling two turns at once is held to one: the database refuses the second', async () => {
      const business = newBusiness();
      const [a, b] = [await put(business), await put(business)];
      const results = await Promise.all([tickets.call(business, a.id, operator('same'), null, NOW, false), tickets.call(business, b.id, operator('same'), null, NOW, false)]);
      assert.deepEqual(results.map((result) => result.kind).sort(), ['called', 'operator-busy']);
      const busy = await tickets.callNext(business, 'q1', operator('same'), NOW, false);
      assert.equal(busy.kind, 'operator-busy');
      assert.equal(await tickets.countOpen(business, 'q1'), 2);
    });
    it('completing the same turn many times at once changes it once', async () => {
      const business = newBusiness();
      const waiting = await put(business);
      await tickets.call(business, waiting.id, operator('me'), null, NOW, false);
      const results = await Promise.all(Array.from({ length: 8 }, () => tickets.finish(business, waiting.id, 'completed', operator('me'), null, NOW, null)));
      assert.equal(results.filter((result) => result !== null).length, 1);
      assert.equal((await tickets.findById(business, waiting.id))!.events.filter((event) => event.type === 'completed').length, 1);
    });
    it('only the operator who has the turn finishes it; a waiting turn can be cancelled by anyone allowed, and outside their queues by nobody', async () => {
      const business = newBusiness();
      const [mine, waiting] = [await put(business), await put(business)];
      await tickets.call(business, mine.id, operator('me'), null, NOW, false);
      assert.equal(await tickets.finish(business, mine.id, 'completed', operator('other'), null, NOW, null), null);
      assert.equal(await tickets.finish(business, mine.id, 'cancelled', operator('other'), null, NOW, null), null);
      assert.equal(await tickets.finish(business, waiting.id, 'completed', operator('me'), null, NOW, null), null, 'a waiting turn cannot be completed');
      assert.equal(await tickets.finish(business, waiting.id, 'cancelled', operator('other'), ['elsewhere'], NOW, 'x'), null, 'queue not allowed');
      const cancelled = await tickets.finish(business, waiting.id, 'cancelled', operator('other'), ['q1'], NOW, 'Se fue');
      assert.deepEqual([cancelled?.status, cancelled?.cancelReason], ['cancelled', 'Se fue']);
      assert.equal((await tickets.finish(business, mine.id, 'no-show', operator('me'), null, NOW, null))?.status, 'no-show');
    });
    it('gives a turn back to the line in its original place, and the operator is free to attend another', async () => {
      const business = newBusiness();
      const [first, second] = [await put(business), await put(business)];
      await tickets.call(business, first.id, operator('me'), null, NOW, false);
      const released = await tickets.releaseOf(business, 'me', NOW);
      assert.deepEqual([released?.status, released?.attendedBy, released?.calledAt], ['waiting', null, null]);
      assert.equal((await tickets.head(business, 'q1'))?.id, first.id);
      assert.equal((await tickets.call(business, second.id, operator('me'), null, NOW, false)).kind, 'called');
      assert.equal(await tickets.releaseOf(business, 'nobody', NOW), null);
    });
  });

  describe('reading', () => {
    it('lists, filters and searches inside one business, escaping what looks like a pattern', async () => {
      const business = newBusiness();
      const a = await put(business, { customer: { name: 'Ana (premium) [vip]', phone: null, email: null } });
      const b = await put(business, { queueId: 'q2', customer: { name: 'Beto', phone: '+573001112233', email: 'beto@x.co' } });
      await put(newBusiness(), { customer: { name: 'Ana (premium) [vip]', phone: null, email: null } });
      const find = async (filter: Parameters<MongoTicketRepository['list']>[1]) => (await tickets.list(business, filter, 'arrival', { page: 1, pageSize: 10 })).items.map((item) => item.id);
      assert.deepEqual(await find({ queueIds: null }), [a.id, b.id]);
      assert.deepEqual(await find({ queueIds: ['q2'] }), [b.id], 'only the queues allowed');
      assert.deepEqual(await find({ queueIds: ['q2'], queueId: 'q1' }), [], 'a queue asked outside the allowed ones gives nothing');
      assert.deepEqual(await find({ queueIds: null, search: '(premium) [vip]' }), [a.id], 'the text is not a pattern');
      assert.deepEqual(await find({ queueIds: null, search: '.*' }), [], 'and "match everything" matches nothing');
      assert.deepEqual(await find({ queueIds: null, search: '1112233' }), [b.id]);
      assert.deepEqual(await find({ queueIds: null, search: 'BETO@X' }), [b.id]);
      assert.deepEqual(await find({ queueIds: null, statuses: ['completed'] }), []);
      const page = await tickets.list(business, { queueIds: null }, 'newest', { page: 2, pageSize: 1 });
      assert.deepEqual([page.items.map((item) => item.id), page.total], [[a.id], 2]);
    });
    it('counts what is open per queue, the oldest waiting and who is attending', async () => {
      const business = newBusiness();
      const [first] = [await put(business), await put(business), await put(business, { queueId: 'q2' })];
      await tickets.call(business, first.id, operator('me'), null, NOW, false);
      const counts = await tickets.openCounts(business, null);
      assert.deepEqual([counts.get('q1')?.waiting, counts.get('q1')?.attending, counts.get('q2')?.waiting], [1, 1, 1]);
      assert.ok(counts.get('q1')!.oldestWaitingAt instanceof Date);
      assert.deepEqual([...(await tickets.openCounts(business, ['q2'])).keys()], ['q2']);
      assert.equal((await tickets.waitingArrivals(business, null)).length, 2);
      assert.equal((await tickets.attendingNow(business, null))[0].id, first.id);
      assert.equal((await tickets.attendingOf(business, 'me'))?.id, first.id);
      assert.equal(await tickets.attendingOf(business, 'nobody'), null);
    });
    it('reads a range by creation time, the latest activity and the latest calls', async () => {
      const business = newBusiness();
      const [a, b] = [await put(business), await put(business)];
      await tickets.call(business, a.id, operator('me'), null, new Date(NOW.getTime() + 60_000), false);
      await tickets.finish(business, a.id, 'completed', operator('me'), null, new Date(NOW.getTime() + 120_000), null);
      assert.equal((await tickets.inRange(business, null, a.createdAt, new Date(a.createdAt.getTime() + 1), 10)).length, 1, 'the end of the range is not included');
      assert.equal((await tickets.inRange(business, null, NOW, new Date(NOW.getTime() + 3_600_000), 10)).length, 2);
      const activity = await tickets.recentActivity(business, null, 3);
      assert.deepEqual(activity.map((entry) => entry.type), ['completed', 'called', 'created']);
      assert.equal(activity[0].code, a.code);
      assert.deepEqual((await tickets.lastCalled(business, null, 5)).map((item) => item.id), [a.id]);
      assert.ok(b);
    });
  });

  describe('the service on the real database', () => {
    it('forty requests at the same moment get forty different codes, and one retried request makes one turn', async () => {
      const business = newBusiness();
      const clock = new FixedClock('2026-03-04T15:00:00.000Z');
      const directory = new FakeBusinessDirectory();
      directory.set(aBusiness({ id: business }));
      const config = new InMemoryTurnosConfigurationRepository();
      const store = new TurnosConfigurationStore(config, clock);
      const hub = new TurnosRealtimeHub();
      const survey = new TurnosSurveyService(new InMemorySurveyRepository(), new RecordingTransport(), directory, hub, clock, { get: () => undefined } as never, store);
      const service = new TurnosTicketService(tickets, store, clock, hub, survey);
      const configuration = new TurnosConfigurationService(store, directory, service, hub, clock);
      const state = await configuration.get(business);
      await configuration.createOperator(business, operatorInput('Laura', 'laura@x.co', [state.configuration.queues[0].id], { views: ['create-turn', 'my-turns'] }));
      const scope = await new TurnosAccessService(store, directory, clock).forOperator('laura@x.co', business);
      const created = await Promise.all(Array.from({ length: 40 }, () => service.create(scope, state.configuration.queues[0].id, {})));
      const codes = created.map((result) => result.ticket.code);
      assert.equal(new Set(codes).size, 40);
      assert.equal(codes.filter((code) => /-\d{3}$/.test(code)).length, 40);
      const retried = await Promise.all(Array.from({ length: 10 }, () => service.create(scope, state.configuration.queues[0].id, { clientRequestId: 'retry-click-1' })));
      assert.equal(new Set(retried.map((result) => result.ticket.id)).size, 1);
      assert.equal(await ticketModel.countDocuments({ businessId: business, clientRequestId: 'retry-click-1' }), 1);
      // The same operator completing the same turn at once, in an automatic queue, calls exactly one next turn.
      await service.callNext(scope, state.configuration.queues[0].id);
      const first = (await tickets.attendingOf(business, scope.operator!.id))!;
      const completions = await Promise.all(Array.from({ length: 6 }, () => service.complete(scope, first.id)));
      assert.equal(completions.filter((result) => result.applied).length, 1);
      assert.equal((await tickets.attendingNow(business, null)).length, 1);
    });
  });

  describe('surveys', () => {
    const invitation = (businessId: string, extra: Partial<SurveyInvitation> = {}): SurveyInvitation & { token: string } => {
      const { token, hash } = newSurveyToken();
      return {
        id: randomUUID(),
        businessId,
        ticketId: randomUUID(),
        ticketCode: 'C-001',
        queueId: 'q1',
        queueName: 'Caja',
        operatorId: 'op1',
        operatorName: 'Laura',
        customerName: null,
        createdAt: NOW,
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        tokenHash: hash,
        delivery: { email: { status: 'pending', attemptedAt: null, failureCode: null }, whatsapp: { status: 'not-requested', attemptedAt: null, failureCode: null } },
        response: null,
        token,
        ...extra,
      };
    };
    it('one invitation per turn, however many times it is created at once', async () => {
      const business = newBusiness();
      const base = invitation(business);
      const results = await Promise.all(Array.from({ length: 6 }, () => surveys.insertOnce({ ...base, id: randomUUID(), tokenHash: newSurveyToken().hash })));
      assert.equal(results.filter((result) => result.created).length, 1);
      assert.equal(await surveyModel.countDocuments({ businessId: business, ticketId: base.ticketId }), 1);
    });
    it('keeps the first answer when many arrive together, and refuses an expired link', async () => {
      const business = newBusiness();
      const open = invitation(business);
      await surveys.insertOnce(open);
      const results = await Promise.all([1, 2, 3, 4, 5].map((rating) => surveys.answer(hashSurveyToken(open.token), { rating, comment: null, answeredAt: NOW }, NOW)));
      assert.equal(results.filter((result) => result.kind === 'answered').length, 1);
      const expired = invitation(business, { expiresAt: new Date(NOW.getTime() - 1) });
      await surveys.insertOnce(expired);
      assert.equal((await surveys.answer(hashSurveyToken(expired.token), { rating: 5, comment: null, answeredAt: NOW }, NOW)).kind, 'unavailable');
      assert.equal((await surveys.findByTokenHash(hashSurveyToken(expired.token)))?.response, null);
      assert.equal(await surveys.findByTokenHash(hashSurveyToken('unknown-token')), null);
    });
    it('records what happened to each channel, lists the answers inside the queues allowed, and reads a range', async () => {
      const business = newBusiness();
      const a = invitation(business, { queueId: 'q1' });
      const b = invitation(business, { queueId: 'q2', operatorId: 'op2' });
      await surveys.insertOnce(a);
      await surveys.insertOnce(b);
      await surveys.recordDelivery(a.id, { email: { status: 'accepted', attemptedAt: NOW, failureCode: null }, whatsapp: { status: 'not-configured', attemptedAt: NOW, failureCode: null } });
      assert.deepEqual([(await surveys.findByTokenHash(a.tokenHash))?.delivery.email.status, (await surveys.findByTokenHash(a.tokenHash))?.delivery.whatsapp.status], ['accepted', 'not-configured']);
      await surveys.answer(a.tokenHash, { rating: 5, comment: 'Bien', answeredAt: NOW }, NOW);
      await surveys.answer(b.tokenHash, { rating: 3, comment: null, answeredAt: new Date(NOW.getTime() + 1000) }, NOW);
      const mine = await surveys.listResponses(business, { queueIds: ['q1'] }, { page: 1, pageSize: 10 });
      assert.deepEqual([mine.total, mine.items[0].response?.comment], [1, 'Bien']);
      assert.deepEqual((await surveys.listResponses(business, { queueIds: null }, { page: 1, pageSize: 10 })).items.map((item) => item.queueId), ['q2', 'q1'], 'newest answer first');
      assert.equal((await surveys.listResponses(business, { queueIds: null, operatorId: 'op2' }, { page: 1, pageSize: 10 })).total, 1);
      assert.equal((await surveys.inRange(business, { queueIds: ['q2'] }, NOW, new Date(NOW.getTime() + 1000), 10)).length, 1);
    });
  });

  describe('the configuration, with what is new in it', () => {
    it('reads a configuration saved before operators had views, status and the room screen as an active operator with every view', async () => {
      const business = newBusiness();
      const repository = new MongoTurnosConfigurationRepository(configModel);
      const now = NOW;
      await configModel.collection.insertOne({
        businessId: business,
        profile: 'clinic',
        seeded: true,
        touched: true,
        rules: { prefixMode: 'initial', fixedPrefix: null, dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 },
        queues: [{ id: 'q1', name: 'Consulta', color: 'blue', mode: 'auto', averageMinutes: 10, source: 'clinic', overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null } }],
        operators: [{ id: 'o1', name: 'Laura', email: 'laura@x.co', phone: null, queueIds: ['q1'], createdAt: now }],
        currentStep: null,
        visitedSteps: [],
        readyAt: null,
        version: 3,
        createdAt: now,
        updatedAt: now,
      });
      const config = (await repository.find(business))!;
      assert.deepEqual([config.queues[0].status, config.queues[0].fields], ['active', []]);
      assert.deepEqual([config.operators[0].status, config.operators[0].views, config.operators[0].activatedAt], ['active', ['home', 'my-turns', 'create-turn', 'queues', 'surveys'], null]);
      assert.deepEqual([config.roomScreen.enabled, config.roomScreen.recentCalls, config.survey.enabled, config.survey.channels], [false, 5, false, { email: true, whatsapp: false }]);
    });
    it('stores queue fields, operator permissions, the room screen and the survey settings, and returns them unchanged', async () => {
      const business = newBusiness();
      const clock = new FixedClock('2026-03-04T15:00:00.000Z');
      const directory = new FakeBusinessDirectory();
      directory.set(aBusiness({ id: business }));
      const store = new TurnosConfigurationStore(new MongoTurnosConfigurationRepository(configModel), clock);
      const hub = new TurnosRealtimeHub();
      const survey = new TurnosSurveyService(new InMemorySurveyRepository(), new RecordingTransport(), directory, hub, clock, { get: () => undefined } as never, store);
      const service = new TurnosConfigurationService(store, directory, new TurnosTicketService(tickets, store, clock, hub, survey), hub, clock);
      const state = await service.get(business);
      const queue = state.configuration.queues[0];
      await service.updateQueue(business, queue.id, { name: queue.name, mode: queue.mode, averageMinutes: queue.averageMinutes, fields: [{ id: 'doc', label: 'Documento', type: 'text', required: true }, { label: 'Motivo', type: 'select', options: ['Pago', 'Consulta'] }] });
      await service.createOperator(business, operatorInput('Laura', 'laura@x.co', [queue.id], { views: ['surveys', 'home'], status: undefined }));
      const reopened = await new TurnosConfigurationStore(new MongoTurnosConfigurationRepository(configModel), clock).find(business);
      assert.deepEqual(reopened!.queues[0].fields.map((field) => [field.id, field.label, field.type, field.required, field.options]), [['doc', 'Documento', 'text', true, []], [reopened!.queues[0].fields[1].id, 'Motivo', 'select', false, ['Pago', 'Consulta']]]);
      assert.deepEqual([reopened!.operators[0].views, reopened!.operators[0].status, reopened!.operators[0].activatedAt], [['home', 'surveys'], 'pending', null]);
    });
  });
});
