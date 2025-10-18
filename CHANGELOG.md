# Changelog

Todas las novedades relevantes del proyecto. Fechas en formato ISO.

## 2025-10-17

- Login sin rebotes: guard espera hidratación y rehidrata desde localStorage.
- LiveLog persistente: precarga últimos ~50 eventos y filtros por nivel/método/status.
- Vista móvil del LiveLog más compacta.
- PDF/Email asíncronos: respuesta inmediata; evento `pdfReady` y badge “Generando PDF…”.
- `/api/rates` resiliente con caché y degradación; control por `.env`.
- SSE con keep-alives y anti-buffering.
