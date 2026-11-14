# Módulo businesses (frontend)

Los **negocios** del superadmin: lista, asistente de creación y edición en 3 pasos, ficha y exportación. Habla con el módulo
`businesses` del backend (`necto-api`, ver su README para el contrato). El diseño sale de la referencia visual
`necto-negocio-completo` (carpeta `referencias html/`, ignorada por git).

No registra rutas propias: sus piezas se montan dentro del layout del [workspace](../workspace/README.md), que las importa por
`index.ts`. Así `workspace → businesses` es la única dirección (sin ciclos).

## Qué ofrece (`index.ts`)

| Pieza | Para qué |
|-------|----------|
| `businessesStore` | Página actual de negocios con filtros aplicados **por el servidor**, el conteo total (lateral) y el aviso tras guardar. Se vacía al cerrar sesión. |
| `BusinessCard` | Tarjeta del directorio. |
| `BusinessDetailDialog` | Ficha con pestañas **Resumen**, **Módulos** y **Equipo** (teclado: flechas, Inicio y Fin). Pausar/reanudar y *Editar configuración*. |
| `BusinessWizard` | Los 3 pasos: Identidad, Módulos y Jefe de negocio, con el panel lateral de avance. Sirve para crear y para editar. |
| `businessesApi`, `BusinessesError` | Cliente HTTP (`/api/businesses`, que Vite redirige al backend; `VITE_BUSINESSES_API_URL` en otros entornos). |
| `downloadBlob`, `businessErrorMessage`, `CATEGORIES` | Utilidades. |

## Comportamientos a tener en cuenta

- **Doble envío:** al crear, cada envío lleva una cabecera `Idempotency-Key` (un UUID por solicitud). Un doble clic o un reintento con
  los mismos datos reutiliza la clave y el servidor devuelve el mismo negocio; si los datos cambian, se genera otra.
- **Validación en dos lugares:** el formulario valida antes de enviar (nombre, teléfono, correos, sitio web, NIT, categoría) y, si el
  servidor rechaza un campo (`fields` en la respuesta `400`), lo marca en el paso que corresponde.
- **Jefe de negocio:** se asigna en un diálogo (nombre y correo). **No se muestra ningún código**: el código real llega por correo al
  guardar el negocio. Al editar, si cambia el **correo** del jefe se avisa que el anterior perderá el acceso y el nuevo recibirá una
  invitación; si solo cambia el nombre, no se invita de nuevo.
- **Invitación (pestaña Equipo):** muestra lo que se sabe. *Aceptada por el proveedor* **no** significa *recibida*: el texto lo dice
  expresamente. Si falló, indica el motivo (por ejemplo, correo no configurado) y permite reenviar (respetando la espera de 60 s y
  el límite por hora que impone el servidor). Mientras el envío está en curso se consulta unas veces más.
- **Pausar** bloquea al jefe (su sesión deja de funcionar) hasta reanudar.
- **Exportar CSV:** se pide al servidor con el token (no es un enlace directo) y se guarda como archivo; respeta los filtros.
- **Módulos:** el catálogo visual (nombre, descripción, color e icono) vive en `catalog.ts`; los identificadores son los que acepta el
  servidor. Se puede crear un negocio con 0 a 6 módulos.
- `Select` de Elements no es controlado: al limpiar filtros se vuelve a montar con una `key` nueva.

## Estructura

```
businesses/
├── index.ts            Puerta pública
├── types.ts · catalog.ts · draft.ts · errors.ts · download.ts   Tipos, catálogo visual, borrador y validación del formulario, textos de error
├── api/businessesApi.ts
├── stores/businesses.store.ts
├── components/         BusinessCard, BusinessDetailDialog, InvitationPanel, BusinessWizard, BossDialog, SummaryPanel, ModuleIcon, StatusBadge
└── styles/businesses.css   Prefijos `bs-` y `ws-business-*`; usa las variables `--ws-*` del workspace (por eso vive dentro de su layout)
```

## Dependencias

- **Otro módulo**, solo por su puerta pública: `super-admin-auth` (token de la sesión y cierre de sesión).
- **Elements:** `Input`, `Select` y `Label`; los demás controles (categorías, módulos, interruptores) son propios, como en la referencia.
- **Base común:** `brand/NectoLogo`. **Backend:** rutas `/businesses/*` (necto-api).
