# Cotizador — Sistema de cotización AYSAFI

Sistema de cotización para productos AYSAFI orientado a generar presupuestos de forma rápida, consistente y fácil de gestionar.

Stack: **React (Vite)** en el frontend · **Node.js (Express)** en el backend · persistencia en filesystem (`backend/outputs/`).

## Características principales

| Área | Detalle |
|---|---|
| **Autenticación y roles** | Login por email/contraseña, roles `admin` / `cotizador` / `cliente`. Enforcement opcional (`AUTHZ_STRICT`). |
| **Cotizaciones** | Crear, editar, copiar, aprobar y rechazar. PDF y email se generan de forma asíncrona; la UI responde de inmediato. |
| **Tipos de cambio** | Proxy resiliente `/api/rates` con caché local y degradación a 200 ante fallos. |
| **Notificaciones** | Toasts para warn/error vía canal WebSocket público sanitizado. |
| **LiveLog (admin)** | Vista en tiempo real con filtros (nivel, método, status), persistencia NDJSON diaria y rotación configurable. |
| **Multi-destinatario** | El campo "Email Cliente" acepta varios correos separados por coma, punto y coma o espacio. |
| **WhatsApp (opcional)** | Envío vía Meta o Twilio: `WHATSAPP_PROVIDER=meta\|twilio`. |
| **CI** | Pipeline en GitHub Actions: lint + tests + build en pushes a `develop` y `main`. |

## Guías de referencia

- **Flujo de ramas:** [`BRANCH_FLOW_QUICKSTART.md`](BRANCH_FLOW_QUICKSTART.md) — guía rápida con main / develop / feature / hotfix.
- **Manual de uso por roles:** [`USAGE.md`](USAGE.md) — Editor, Desarrollador y Mantenedor.
- **Despliegue:** [`DEPLOYMENT.md`](DEPLOYMENT.md) — opciones cPanel y VPS.
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md).

## Instalación y arranque

### 1. Dependencias

```powershell
# Raíz (backend)
npm install

# Frontend
cd frontend && npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```env
PORT=5000
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Seguridad / Roles
JWT_SECRET=cambia-esto-por-una-clave-larga
AUTHZ_STRICT=false          # true = bloquea rutas sin rol requerido

# API base (si frontend y backend tienen orígenes distintos)
PUBLIC_API_BASE=

# WhatsApp (opcional) — meta o twilio
# WHATSAPP_PROVIDER=meta
# META_WABA_TOKEN=...
# META_PHONE_NUMBER_ID=...

# LiveLog
LIVELOG_RETENTION_DAYS=7    # días de retención de logs NDJSON

# Tipos de cambio
RATES_SOURCE=backend
RATES_TIMEOUT_MS=3000

MORGAN_FORMAT=dev
```

### 3. Arrancar en desarrollo

```powershell
# Todo-en-uno (frontend + backend con recarga)
npm run dev

# O por separado
npm run backend
cd frontend && npm run dev
```

### 4. Configuración de runtime del frontend

El frontend lee `/config.js` en tiempo de carga: permite cambiar URLs base sin necesidad de rebuild. La página de diagnóstico `/admin/config` muestra la configuración efectiva.

---

## Comandos útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Frontend + backend en modo desarrollo |
| `npm run backend` | Solo backend |
| `npm run lint` | Lint del proyecto |
| `npm run frontend:build` | Build de producción del frontend |
| `npm run test:backend` | Tests unitarios/smoke del backend |
| `npm run test:frontend` | Tests del frontend (Vitest) |
| `npm run test:security` | Seguridad HTTPS local |
| `npm run ci:verify` | Verificación completa (lint + tests + build) |
| `npm run package:cpanel` | Empaqueta para despliegue en cPanel |
| `npm run enable:https:dev` | Genera certificados TLS locales para WSS |

---

## LiveLog y WebSockets

- **Vista admin:** `/admin/livelog` — requiere token JWT (login en `/admin/login`).
- **Canal admin:** `wss://<host>/ws?token=<JWT>` — todos los eventos.
- **Canal público:** `wss://<host>/ws-public` — solo warn/error sanitizados.
- Logs NDJSON rotativos por día en `backend/outputs/logs/`. Retención: `LIVELOG_RETENTION_DAYS` (default 7).

---

## Notas de pruebas y despliegue

- Si el backend (puerto 8443) no es alcanzable, las pruebas E2E se marcan como SKIP sin fallar la suite.
- Si `/admin/login` devuelve 404 en producción, verifica el fallback SPA en `.htaccess`.
- Para HTTPS local y WSS seguros:

```powershell
npm run enable:https:dev
$env:HTTPS="true"; $env:TLS_CERT_FILE=".\backend\certs-dev\localhost.crt"; $env:TLS_KEY_FILE=".\backend\certs-dev\localhost.key"; npm run backend
```

- Despliegue VPS: `npm run deploy:vps` usa `deploy.vps.json` (útil cuando el frontend vive en cPanel).
