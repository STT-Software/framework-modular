import { describe, expect, it } from "vitest";
import { OnboardingError, type Profile } from "./api/onboardingApi";
import { nextOnboardingPath, resolveWelcomeMode, welcomeMode } from "./flow";
import { AFTER_ONBOARDING_PATH, PHONE_STEP_PATH, SOURCE_STEP_PATH } from "./paths";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  phone: null,
  sources: [],
  sourceOther: null,
  completed: false,
  introSeen: false,
  ...overrides,
});

describe("nextOnboardingPath", () => {
  it("lleva al workspace si el perfil está completo", () => {
    expect(nextOnboardingPath(profile({ phone: "+573001234567", completed: true }))).toBe(AFTER_ONBOARDING_PATH);
  });

  it("completo aunque haya omitido el paso 2 (sin fuentes)", () => {
    expect(nextOnboardingPath(profile({ phone: "+573001234567", sources: [], completed: true }))).toBe(
      AFTER_ONBOARDING_PATH,
    );
  });

  it("retoma en el paso 2 si ya guardó el teléfono", () => {
    expect(nextOnboardingPath(profile({ phone: "+573001234567" }))).toBe(SOURCE_STEP_PATH);
  });

  it("empieza en el paso 1 sin teléfono, sin mirar las fuentes", () => {
    expect(nextOnboardingPath(profile())).toBe(PHONE_STEP_PATH);
    expect(nextOnboardingPath(profile({ sources: ["instagram"] }))).toBe(PHONE_STEP_PATH);
  });
});

describe("decisión de /welcome", () => {
  it("muestra la intro solo a quien no la vio ni completó el perfil", () => {
    expect(welcomeMode(profile())).toBe("intro");
    expect(welcomeMode(profile({ introSeen: true }))).toBe("loader");
    expect(welcomeMode(profile({ completed: true }))).toBe("loader");
  });

  it("sin perfil (la consulta falló) va a la pantalla de carga", () => {
    expect(welcomeMode(null)).toBe("loader");
  });

  it("decide con el perfil que trae la consulta", async () => {
    await expect(resolveWelcomeMode(async () => profile())).resolves.toBe("intro");
    await expect(resolveWelcomeMode(async () => profile({ introSeen: true }))).resolves.toBe("loader");
  });

  it("un error del servicio nunca muestra la intro", async () => {
    await expect(
      resolveWelcomeMode(() => Promise.reject(new OnboardingError("network", null, "offline"))),
    ).resolves.toBe("loader");
  });
});
