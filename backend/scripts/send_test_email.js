require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { transporter } = require('../utils/email');

(async () => {
  const to = process.env.SMTP_TEST_TO || process.env.SMTP_USER;
  if (!to) {
    console.error('Define SMTP_TEST_TO o SMTP_USER en el entorno para enviar correo de prueba');
    process.exit(1);
  }
  try {
    console.log('Enviando correo de prueba a', to);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Prueba SMTP - Cotizador',
      text: 'Este es un correo de prueba del sistema Cotizador.'
    });
    console.log('Mensaje enviado:', info.messageId || info);
    process.exit(0);
  } catch (e) {
    console.error('Error enviando correo de prueba:', e && e.message, e && e.code);
    if (e && e.response) console.error('Response:', e.response);
    process.exit(1);
  }
})();
