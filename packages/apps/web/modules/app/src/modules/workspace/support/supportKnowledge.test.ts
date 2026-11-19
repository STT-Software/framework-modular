import { describe, expect, it } from "vitest";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_FALLBACK_REPLY,
  SUPPORT_FAQS,
  SUPPORT_QUICK_TOPICS,
  filterSupportFaqs,
  replyToSupportQuestion,
} from "./supportKnowledge";

describe("supportKnowledge · filterSupportFaqs", () => {
  it("returns all FAQ items when query is empty and no category is selected", () => {
    expect(filterSupportFaqs("", null)).toHaveLength(SUPPORT_FAQS.length);
    expect(filterSupportFaqs("   ", null)).toHaveLength(SUPPORT_FAQS.length);
  });

  it("filters strictly by category when a category pill is selected", () => {
    for (const category of SUPPORT_CATEGORIES) {
      const results = filterSupportFaqs("", category);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((item) => item.category === category)).toBe(true);
    }
  });

  it("matches queries case- and accent-insensitively", () => {
    const moduleResults = filterSupportFaqs("modulos", null);
    expect(moduleResults.map((item) => item.id)).toContain("available-modules");
    expect(moduleResults.map((item) => item.id)).toContain("manage-modules");

    const codeResults = filterSupportFaqs("CODIGO TEMPORAL", null);
    expect(codeResults.map((item) => item.id)).toContain("temporary-access-code");
  });

  it("combines category and query filters together", () => {
    const results = filterSupportFaqs("codigo", "Accesos OTP");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.category === "Accesos OTP")).toBe(true);
    expect(results.map((item) => item.id)).toContain("temporary-access-code");

    const mismatch = filterSupportFaqs("csv", "Módulos");
    expect(mismatch).toEqual([]);
  });

  it("returns an empty list when no FAQ matches the query", () => {
    expect(filterSupportFaqs("facturacion satelital inexistente", null)).toEqual([]);
  });
});

describe("supportKnowledge · replyToSupportQuestion", () => {
  it("answers every quick-topic prompt with a non-fallback Necto answer", () => {
    for (const topic of SUPPORT_QUICK_TOPICS) {
      const reply = replyToSupportQuestion(topic.question);
      expect(reply).not.toBe(SUPPORT_FALLBACK_REPLY);
      expect(reply.length).toBeGreaterThan(30);
    }
  });

  it("answers exact FAQ questions with their exact knowledge-base answer", () => {
    for (const faq of SUPPORT_FAQS) {
      expect(replyToSupportQuestion(faq.question)).toBe(faq.answer);
    }
  });

  it("matches natural accent-free Spanish questions to the right FAQ", () => {
    expect(replyToSupportQuestion("Como funciona el login OTP del administrador?")).toContain("OTP");
    expect(replyToSupportQuestion("Necesito generar un codigo temporal de 10 minutos")).toContain(
      "10 minutos",
    );
    expect(replyToSupportQuestion("Quiero pausar o reanudar un negocio")).toContain("pausado");
    expect(replyToSupportQuestion("Como exportar la lista a CSV?")).toContain("Exportar CSV");
    expect(replyToSupportQuestion("Que modulos incluyen reservas, turnos e inventario?")).toContain(
      "Reservas",
    );
    expect(replyToSupportQuestion("Como edito la moneda y zona horaria de un negocio?")).toContain(
      "Editar configuración",
    );
  });

  it("returns the WhatsApp and email fallback for blank, greeting-only, or unmatched questions", () => {
    expect(replyToSupportQuestion("")).toBe(SUPPORT_FALLBACK_REPLY);
    expect(replyToSupportQuestion("   ")).toBe(SUPPORT_FALLBACK_REPLY);
    expect(replyToSupportQuestion("Hola, necesito ayuda")).toBe(SUPPORT_FALLBACK_REPLY);
    expect(replyToSupportQuestion("¿Cuál es el precio de un boleto aéreo a Marte?")).toBe(
      SUPPORT_FALLBACK_REPLY,
    );
    expect(SUPPORT_FALLBACK_REPLY).toContain("WhatsApp");
    expect(SUPPORT_FALLBACK_REPLY).toContain("soporte@necto.co");
  });
});
