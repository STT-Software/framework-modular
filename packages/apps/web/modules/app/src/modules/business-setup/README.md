# Módulo business-setup (frontend)
La **configuración inicial (base) del negocio**, hecha por su **administrador** (el jefe que entra con código por correo). El diseño sale de la
referencia `necto-negocios-configuracion` (carpeta `referencias html/`, ignorada por git), **sin** sus controles de demostración ni sus datos de
ejemplo. Todo lo que decide el acceso, qué módulos tiene el negocio y qué horarios son válidos lo decide el servidor (`necto-api`, módulo
`business-setup`; contrato completo en su README).
## Rutas
| Ruta | Pantalla |
|------|----------|
| `/business/setup` | Entrada: si la persona administra un solo negocio lo abre; si no, la manda a `/business/access`. |
| `/business/setup/:businessId` | Los módulos que el superadministrador habilitó para ese negocio y si la base está preparada. |
| `/business/setup/:businessId/:step` | `data`, `schedule`, `category` o `review`. |
Son rutas **sin** la puerta del superadmin: la sesión es la del administrador (`business-access`). Sin sesión vigente, la página lleva a `/business/access`.
Desde la pantalla «Ya estás en tu negocio» de `business-access` hay un botón «Preparar mi negocio» que llega aquí.
## Los pasos
1. **Datos del negocio**: nombre, teléfono, correo, dirección, razón social, NIT, sitio web, descripción y logo (PNG, JPG o WebP de hasta 10 MB; se reduce a 256×256 en el navegador y el archivo subido no pasa de 1 MB, el límite del servicio). Se cargan los datos que
   registró el superadmin (el mismo documento del negocio, no una copia). Moneda y zona horaria se muestran, pero no se editan.
2. **Horarios**: pestaña «Negocio» y una por módulo asignado. Un módulo puede **usar el horario del negocio** (hereda: lo que cambie el negocio se ve en él) o tener
   el suyo (excepción que se conserva aunque el negocio cambie). Varias franjas por día; apertura y cierre obligatorios, cierre posterior y sin solapes.
3. **Tipo de negocio**: la categoría registrada, para confirmarla. «Otro / Personalizado» exige su descripción. Si el negocio tiene **Turnos**, aquí también se elige su
   **perfil de atención** (lo que sugiere sus primeras filas): el dato **pertenece a Turnos** (lo guarda el servidor allí y es el mismo que edita el primer paso de Turnos), así que
   cambiarlo desde aquí nunca borra ni duplica lo ya configurado en Turnos. Solo se envía si la persona lo cambió.
4. **Revisión**: resume la base y guarda con «Guardar configuración base». Eso marca **solo la base**; los ajustes de cada módulo siguen pendientes.
## Cómo guarda y recupera
- **Cada paso se guarda en el servidor al avanzar** (y al volver atrás si tiene cambios válidos). Cerrar sesión no pierde nada: al volver, `GET` devuelve todo y
  la página abre en el paso donde quedó (`Continuar configuración`). Recargar también recupera la sesión por la cookie (`business-access`).
- Si un paso no es válido, la página no avanza y lleva al paso con el problema; el servidor vuelve a validar todo y sus errores por campo (`fields`) se muestran
  en el campo o la franja que corresponde.
- Cualquier cambio posterior a «Guardar configuración base» la deja otra vez como «por preparar».
- Los borradores viven en el store (MobX) y se rehacen con lo que devolvió el servidor. No se guarda nada en `localStorage` ni `sessionStorage`.
## Dependencias entre módulos (anotadas como pide `arquitectura.md`)
- `business-access` (por su `index.ts`): la sesión del administrador (`adminAccessStore.ensureSession`, `withToken`), `AccessError` y los tipos.
- `businesses` (por su `index.ts`): el catálogo de módulos (`moduleInfo`), `categoryLabel` y los tipos `ModuleId` y `CategoryId`.
- `business-access` enlaza aquí con un botón, sin importar este módulo.
- La tarjeta de **Turnos** de la pantalla de módulos refleja `settings.status` (`Configuración preparada` / `Configurar`) y lleva a `/business/turnos/:id/profile`; su configuración vive en el módulo `turnos`, que no se importa desde aquí (solo se navega a su ruta).
## Notas
- El logo necesita el `Authorization`, así que se descarga con `fetch` y se muestra con un `blob:` URL (se libera al salir o cambiar de imagen).
- Las horas son **del negocio** (su zona horaria): el navegador no las convierte.
- La referencia navega con `#hash`; aquí cada paso tiene su ruta, así que «atrás» del navegador y recargar funcionan.
- El cliente llama a `/api/business-setup` (proxy de Vite que quita el prefijo; `VITE_BUSINESS_SETUP_API_URL` en otros entornos).
- No hay pruebas automáticas del frontend (como el resto de módulos); se verificó a mano en el navegador contra el backend real.
## Estructura
```
business-setup/
├── index.ts                         Puerta pública: la ruta
├── api/businessSetupApi.ts          Cliente HTTP de /business-setup, con errores por campo
├── stores/businessSetup.store.ts    Estado, borradores, validación y guardado por paso (MobX)
├── schedule.ts                      Reglas de horarios (espejo de las del servidor) y textos
├── types.ts  initials.ts
├── pages/BusinessSetupPage.tsx      Marco, rutas, carga y cambio de negocio
├── components/                      ModulesView, Wizard, DataPanel, SchedulePanel, CategoryPanel, ReviewPanel, SavedDialog...
└── styles/business-setup.css        Estilos de la referencia (prefijo `no-`)
```
