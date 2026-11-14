# Módulo business-access (frontend)

La entrada del **jefe de un negocio**: una pantalla pública donde entra **sin contraseña**, con un código de 6 dígitos que recibe
por correo. Habla con las rutas `/business-access/*` de `necto-api` (ver su README).

> **No viene de la referencia.** `necto-negocio-completo` no incluye esta pantalla (solo muestra un código "de ejemplo" al asignar
> al jefe). Se diseñó aquí con la paleta, la tipografía y los componentes de Elements del resto de la app. Si hay un diseño
> oficial, hay que sustituirla.

## Ruta

| Ruta | Pantalla |
|------|----------|
| `/business/access?business=<id>` | Acceso del jefe. Es el enlace que lleva el correo de invitación (`PUBLIC_APP_URL` en el backend). |

Es **pública**: no pasa por la puerta del superadmin. Sin `business` o con un id con formato inválido, dice que el enlace no es válido.

## Flujo

1. **Correo:** la persona escribe su correo y pide el código. El servidor responde igual exista o no ese correo en el negocio, así
   que la pantalla dice "*Si* este correo es el del jefe de este negocio, te enviamos un código" (nunca afirma que se envió).
2. **Código:** 6 dígitos. Un código errado, vencido, ya usado o de otro negocio da el mismo mensaje genérico. *Pedir otro código*
   espera 60 s (el servidor impone además sus propios límites y responde `429` con el tiempo de espera).
3. **Inicio del jefe:** saluda, muestra el negocio, su estado, el correo de acceso y los módulos habilitados. Es un inicio mínimo: las
   herramientas de cada módulo aparecerán cuando existan.

El servidor valida la sesión del jefe en **cada** petición. Por eso: si el negocio se **pausa**, la pantalla dice que está en pausa; si
el jefe es **reemplazado** o la sesión vence, vuelve al paso del correo.

## Sesión separada

La sesión del jefe (`bossSessionStore`, clave `business-access:session` en `sessionStorage`) es **distinta** de la del superadmin. Entrar
como jefe no da permisos de superadmin ni cierra su sesión, y un token de jefe es rechazado en las rutas de superadmin (y al revés).

## Estructura

```
business-access/
├── index.ts                         Puerta pública: la ruta
├── api/businessAccessApi.ts         /api/business-access (VITE_BUSINESS_ACCESS_API_URL en otros entornos)
├── stores/bossSession.store.ts      Sesión del jefe
├── pages/BusinessAccessPage.tsx
├── components/                      CodeLogin (correo y código) y BossHome (inicio)
└── styles/business-access.css       Prefijo `ba-`, claro y oscuro
```

## Dependencias

- **Otros módulos:** ninguno. **Elements:** `Input` y `Label`. **Base común:** `brand/NectoLogo`, `ThemeIconButton`, `PageMeta`.
- **Fuente:** DM Sans, cargada solo con este módulo.
