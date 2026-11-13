---
inclusion: always
---

# Contexto del proyecto framework-modular

Al empezar una sesión en este repo, **lee `docs/ai-context.md`** antes de actuar. Contiene el estado
actual, el runbook para levantar todo, las carpetas de referencia y las trampas conocidas.

Reglas críticas:

- Responde en **español**; el **código, los nombres y los mensajes de error van en inglés**; la interfaz y
  la documentación, en español.
- **No hagas commit, push ni abras PR si no te lo piden.** Los PRs van a `integration`.
- No crees ramas por tu cuenta. Ramas **end to end** (backend + frontend + documentación).
- **Monolito modular:** un solo backend (`necto-api`: un proceso, un puerto, una base) con `platform/` (transversal) y
  `modules/<modulo>/` (por capacidad de negocio, con `public.ts`), + un módulo de frontend por cada uno (`src/modules/`).
  En el backend un módulo solo importa a otro por su `public.ts` y sin ciclos (`npm run test:api` lo comprueba); en el
  frontend, por su `index.ts`, declarado en su README.
- UI con **Elements**; no modifiques `src/elements/`.
- Verifica en el navegador y contra los servicios reales; responde exactamente lo que se preguntó.
- Si cambias el estado del proyecto, actualiza `docs/ai-context.md`.
