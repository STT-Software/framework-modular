import { afterEach, describe, expect, it, vi } from "vitest";
import { superAdminAuthApi, SuperAdminAuthError } from "./superAdminAuthApi";

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

async function failure(promise: Promise<unknown>): Promise<SuperAdminAuthError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SuperAdminAuthError) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

const verify = () => superAdminAuthApi.verifyRegistration({ registrationId: "a".repeat(24), code: "123456" });

describe("superAdminAuthApi registration code", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the pending registration from register", async () => {
    const pending = {
      registrationId: "a".repeat(24),
      email: "ana@correo.com",
      expiresAt: "2026-01-01T00:10:00.000Z",
      resendAvailableAt: "2026-01-01T00:01:00.000Z",
    };
    respondWith(202, pending);
    await expect(
      superAdminAuthApi.register({
        username: "ana",
        email: "ana@correo.com",
        password: "x",
        identityDocumentType: "CC",
        identityDocument: "1",
        acceptTerms: true,
      }),
    ).resolves.toEqual(pending);
  });

  it.each([
    [400, "invalid-code", "invalid-code"],
    [400, "code-expired", "code-expired"],
    [429, "too-many-attempts", "too-many-attempts"],
    [429, "resend-too-soon", "resend-too-soon"],
  ] as const)("maps %i with code %s to kind %s", async (status, code, kind) => {
    respondWith(status, { message: "x", error: "x", statusCode: status, code });
    expect((await failure(verify())).kind).toBe(kind);
  });

  it("falls back to the status when there is no code", async () => {
    respondWith(429, { message: "ThrottlerException", statusCode: 429 });
    expect((await failure(verify())).kind).toBe("rate-limited");

    respondWith(409, { message: "A super admin with that email already exists", statusCode: 409 });
    const conflict = await failure(verify());
    expect(conflict.kind).toBe("conflict");
    expect(conflict.field).toBe("email");
  });

  it("sends the registration id to resend", async () => {
    respondWith(202, {});
    await superAdminAuthApi.resendRegistrationCode("b".repeat(24));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/super\/register\/resend$/);
    expect(JSON.parse(String(init?.body))).toEqual({ registrationId: "b".repeat(24) });
  });
});
