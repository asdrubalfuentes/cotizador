# Cotizador (scaffold)

Proyecto scaffold para un cotizador con frontend en React (Vite) y backend en Node.js (Express). Persistencia en filesystem (`outputs/`). Ahora usa variables de entorno para unificar el directorio `outputs` y logging de requests.

Guías útiles:
- Flujo de ramas: ver `BRANCH_FLOW_QUICKSTART.md` para una guía rápida de trabajo con main/develop/feature/hotfix.

Instalación y ejecución (backend)

## 1. Instala dependencias en la raíz:

```powershell
npm install
```

## 2. Instala dependencias del frontend y arranca en modo desarrollo:

```powershell
cd frontend
npm install
npm run dev
```

## 3. Arranca el backend (desde la raíz):

```powershell
npm run backend
```

## 4. Desarrollo todo-en-uno (frontend + backend con recarga y morgan):

```powershell
npm run dev
```

## 5. Variables de entorno (crear `.env` basado en `.env.example`):

```
PORT=5000
OUTPUTS_DIR=outputs
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
MORGAN_FORMAT=dev
```

## 5. Notas de despliegue en cPanel

- Frontend: build con `cd frontend && npm run build` y subir `dist` a `public_html`.
- Backend: cPanel Application Manager puede ejecutar apps Node.js; configurar `backend/server.js` como entrypoint y variables de entorno según `.env.example`.
