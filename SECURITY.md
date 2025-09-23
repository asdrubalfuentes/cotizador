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
