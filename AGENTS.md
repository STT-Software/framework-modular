# Instrucciones para agentes de IA

**Antes de hacer cualquier cosa en este repo, lee [`docs/ai-context.md`](docs/ai-context.md).**
Es el documento más importante del proyecto: estado actual, reglas del equipo, cómo levantar todo,
carpetas de referencia y trampas conocidas. Está escrito para retomar el trabajo en una sesión nueva.

Reglas críticas (el detalle está en ese documento):

- Habla con la persona en **español**. El **código va en inglés**; la interfaz y la documentación, en español.
- **No hagas commit, push ni abras PR si no te lo piden.** Los PRs van a `integration`, nunca a `main`, `test` ni `production`.
- No crees ramas por tu cuenta. Las ramas son **end to end**: backend, frontend y documentación juntos.
- Monolito modular "screaming": **un solo backend** (`necto-api`: un proceso, un puerto, una base de datos), organizado por capacidad de negocio en `modules/<modulo>/` con infraestructura transversal en `platform/`, + un módulo de frontend por cada módulo. Un módulo solo importa a otro por su `public.ts`, sin ciclos (lo comprueba `npm run test:api`).
- La UI se construye con **Elements** y no se modifican sus archivos (`src/elements/`).
- **Verifica antes de afirmar** (navegador y servicios reales) y limpia tus datos de prueba.
- Si cambias el estado del proyecto, **actualiza `docs/ai-context.md`** en el mismo PR.
