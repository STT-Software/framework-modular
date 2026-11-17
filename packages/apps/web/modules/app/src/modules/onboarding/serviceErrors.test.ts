import { describe, expect, it } from "vitest";
import { OnboardingError } from "./api/onboardingApi";
import {
  isPhoneInUseError,
  isPhoneRequiredError,
  PHONE_IN_USE_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
  serviceErrorMessage,
} from "./serviceErrors";

describe("errores del servicio por código", () => {
  it("phone-in-use", () => {
    const error = new OnboardingError("conflict", 409, "Phone number already in use", "phone-in-use");
    expect(isPhoneInUseError(error)).toBe(true);
    expect(isPhoneRequiredError(error)).toBe(false);
    expect(serviceErrorMessage(error)).toBe(PHONE_IN_USE_MESSAGE);
  });

  it("phone-required no se confunde con un número en uso", () => {
    const error = new OnboardingError("conflict", 409, "Save the phone number first", "phone-required");
    expect(isPhoneRequiredError(error)).toBe(true);
    expect(isPhoneInUseError(error)).toBe(false);
    expect(serviceErrorMessage(error)).toBe(PHONE_REQUIRED_MESSAGE);
  });

  it("un 409 sin código (servicio anterior) sigue siendo número en uso", () => {
    expect(isPhoneInUseError(new OnboardingError("conflict", 409, "Phone number already in use"))).toBe(true);
  });

  it("sin código decide por el tipo", () => {
    expect(serviceErrorMessage(new OnboardingError("network", null, "offline"))).toMatch(/conexión/);
  });
});
