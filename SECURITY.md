# Seguridad

Si encuentras una vulnerabilidad, por favor reporta de forma responsable:

1. No abras un issue público con información sensible.
2. Envía un correo a [contacto@aysafi.com](mailto:contacto@aysafi.com) con detalles y pasos para reproducir.
3. Espera confirmación y coordina para la divulgación responsable.

Gracias por ayudar a mantener el proyecto seguro.

---

## Pruebas automatizadas de seguridad (overview)

Este proyecto incluye pruebas automatizadas que ayudan a detectar problemas frecuentes de seguridad y configuración:

- Prueba HTTPS local: levanta el backend en HTTPS con certificado auto-firmado y recorre rutas críticas, verificando que no haya referencias `http://` y que SSE/CORS funcionen en lo básico.

```powershell
npm run test:security
```

- Prueba E2E en producción: valida el frontend público y el backend (en 8443 por defecto), comprobando HTML, assets, SPA, `/config.js` (si existe), SSE y CORS. Si el backend no está disponible, marca las pruebas de backend como SKIP.

```powershell
# variables opcionales
$env:FRONTEND_URL_PROD="https://cotizador.aysafi.com"; $env:BACKEND_URL_PROD="https://emqx.aysafi.com:8443"; npm run test:security:prod
```

Notas:

- Si usas Nginx en 443 para ocultar 8443, puedes establecer `BACKEND_URL_PROD` a `https://emqx.aysafi.com`.
- Si un proxy corporativo interfiere con TLS, usa `SKIP_TLS_VERIFY=1` bajo tu propia responsabilidad para ejecutar la suite.
- Las suites sólo hacen operaciones de lectura en producción; no crean ni borran cotizaciones.

---

## LiveLog y WebSocket seguros

Este proyecto expone dos canales WebSocket y endpoints administrativos asociados al registro de eventos:

- Admin WS: `wss://<host>/ws?token=<JWT>`
  - Requiere token JWT con rol `admin` (obtenido en `POST /api/admin/login`).
  - Entrega todos los eventos (HTTP, consola, app) para observabilidad.
  - Uso: solo para operadores/administradores.

- Público WS: `wss://<host>/ws-public`
  - No requiere autenticación.
  - Entrega únicamente eventos sanitizados de nivel `warn` y `error` (sin PII ni payloads sensibles) para mostrar avisos no intrusivos a usuarios.

Consideraciones de seguridad:

- Transport layer: exponer SIEMPRE sobre `wss://` detrás de `https://` para evitar “mixed content” y ataques de intermediario.
- Token en query: el admin WS pasa `token` por query para el handshake. Mitigaciones:
  - Mantener tokens de corta duración (exp. 8h por defecto).
  - Usar exclusivamente `wss://`; no registrar URLs con query en logs o analytics.
  - Almacenar el token en memoria (no en cookies) en el cliente admin.
- Minimización de datos: el canal público elimina campos sensibles; evita hacer `console.log` de secretos/PII en el backend, porque el canal admin replica consola.
- Retención de logs: archivos NDJSON diarios en `backend/outputs/logs/` con retención configurable vía `LIVELOG_RETENTION_DAYS` (7 por defecto). Ajusta según tu política.
- Autorización estricta: define `AUTHZ_STRICT=1` para aplicar middleware de roles en rutas sensibles (incluyendo APIs de LiveLog: listar/descargar/borrar archivos).

Exposición de configuración (/api/config):

- El backend puede exponer `/api/config` con configuración efectiva para diagnóstico. Por defecto, refleja lo que ya es público en `frontend/config.js`.
- Si deseas restringir su acceso, define `ADMIN_PASSWORD` y usa `POST /api/admin/login` para obtener token; protege `/api/config` con `Authorization: Bearer <token>`.

Endpoints admin relacionados:

- GET `/api/admin/livelog/files` → lista archivos.
- GET `/api/admin/livelog/file/:day` → descarga stream NDJSON.
- DELETE `/api/admin/livelog/file/:day` → elimina archivo del día.

Roles recomendados:

- `admin`: acceso a LiveLog, mantenedores y diagnóstico.
- `cotizador`: creación/edición de cotizaciones (sin acceso a LiveLog/admin WS).
- `cliente`: aceptación/rechazo con token.

---

## HTTPS/WSS, Nginx y timeouts para SSE/WS

Para estabilidad y seguridad en tiempo real:

- Sirve el backend detrás de Nginx con TLS en 443. Evita TLS doble salvo que sea requisito.
- SSE: desactiva buffering y sube los timeouts de lectura/escritura.
- WS: habilita headers de Upgrade y Connection, HTTP/1.1 y timeouts altos.

Bloque de ejemplo para WS/SSE:

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 443 ssl http2;
  server_name emqx.aysafi.com;

  ssl_certificate     /etc/letsencrypt/live/emqx.aysafi.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/emqx.aysafi.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
  }

  # WebSockets (admin y público)
  location /ws {                       # Admin WS
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
  }
  location /ws-public {                # Público WS
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
  }
}
```

Buenas prácticas TLS/CSP:

- Habilita HSTS en el dominio público tras validar HTTPS estable.
- Usa suites TLS modernas; evita TLS1.0/1.1 y cifrados débiles.
- Configura CSP en el frontend (al menos `default-src 'self'` y permitir explícitamente `connect-src` al API/WS), reduciendo riesgo de XSS.

---

## Checklist de endurecimiento (operación)

- [ ] Rotar `JWT_SECRET` si sospechas filtración.
- [ ] Establecer `AUTHZ_STRICT=1` en producción.
- [ ] Ajustar `LIVELOG_RETENTION_DAYS` a tu política de retención.
- [ ] Revisar `.htaccess`/CSP en frontend (cPanel) para evitar `http://` en assets.
- [ ] Validar que Nginx tenga `proxy_buffering off` para SSE y `Upgrade` para WS.
- [ ] Limitar tamaño de carga (`client_max_body_size`) y considerar `limit_req` para mitigación de abuso.
