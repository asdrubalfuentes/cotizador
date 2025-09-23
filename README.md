# Cotizador (scaffold)

Proyecto scaffold para un cotizador con frontend en React (Vite) y backend en Node.js (Express). Persistencia en filesystem (`outputs/`).

Novedades:

- Configuración de runtime del frontend vía `/config.js` (no requiere rebuild para cambiar URLs base)
- Página de diagnóstico protegida: `/admin/config` para ver la configuración efectiva
- Script de empaquetado cPanel: `npm run package:cpanel`

Guías útiles:

- Flujo de ramas: ver `BRANCH_FLOW_QUICKSTART.md` para una guía rápida de trabajo con main/develop/feature/hotfix).
- Manual de uso por roles: ver `USAGE.md` (Editor, Desarrollador y Mantenedor).

Instalación y ejecución (backend)

## 1. Instala dependencias en la raíz

```powershell
npm install
```

## 2. Instala dependencias del frontend y arranca en modo desarrollo

```powershell
cd frontend
npm install
npm run dev
```

## 3. Arranca el backend (desde la raíz)

```powershell
npm run backend
```

## 4. Desarrollo todo-en-uno (frontend + backend con recarga y morgan)

```powershell
npm run dev
```

## 5. Variables de entorno (crear `.env` basado en `.env.example`)

```env
PORT=5000
OUTPUTS_DIR=outputs
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
MORGAN_FORMAT=dev

# Frontend/URLs públicas
FRONTEND_URL=https://cotizador.tudominio.cl
# Si el backend expone la API en otra URL/origen, define PUBLIC_API_BASE.
# Déjalo vacío si frontend y backend comparten dominio.
PUBLIC_API_BASE=
```

## 6. Notas de despliegue y configuración en runtime

- El backend sirve `/config.js` con `window.__APP_CONFIG__` (API_BASE y FRONTEND_URL) a partir de variables de entorno.
- El frontend carga `/config.js` antes de inicializar y todas las llamadas usan `apiUrl()`/`eventsUrl()`; al cambiar `PUBLIC_API_BASE` o `FRONTEND_URL` solo necesitas reiniciar la app, no reconstruir.
- Diagnóstico: inicia sesión admin y abre `/admin/config` para ver lo que ve el frontend y lo que expone el backend en `/api/config`.

## 7. Lint antes de construir

Para asegurar calidad, ejecuta lint antes del build:

```powershell
npm run lint ; npm run frontend:build
```

Puedes integrar un script combinado si lo prefieres:

```json
{
  "scripts": {
    "build:checked": "npm run lint && npm run frontend:build"
  }
}
```
