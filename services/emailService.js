const nodemailer = require('nodemailer');

// Configurar transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ========================================
// ✉️ EMAIL DE VERIFICACIÓN
// ========================================
const enviarEmailVerificacion = async (email, nombre, token) => {
  const urlVerificacion = `${process.env.FRONTEND_URL}/verificar-email/${token}`;

  const mailOptions = {
    from: `"Detodo en Cursos Pro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '✅ Verifica tu cuenta - Detodo en Cursos Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #00ff88 0%, #00cc6e 100%);
            color: #0a0a0a;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .btn {
            display: inline-block;
            background: #00ff88;
            color: #0a0a0a;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>¡Bienvenido a Detodo en Cursos Pro! 🎉</h1>
        </div>
        <div class="content">
          <h2>Hola ${nombre},</h2>
          <p>Gracias por registrarte en nuestra plataforma. Para completar tu registro, por favor verifica tu email haciendo click en el botón de abajo:</p>
          
          <div style="text-align: center;">
            <a href="${urlVerificacion}" class="btn">Verificar Email</a>
          </div>
          
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #00ff88;">${urlVerificacion}</p>
          
          <p><strong>Este enlace expira en 24 horas.</strong></p>
          
          <p>Si no creaste esta cuenta, ignora este email.</p>
        </div>
        <div class="footer">
          <p>© 2025 Detodo en Cursos Pro. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

// ========================================
// 🔑 EMAIL DE RECUPERACIÓN DE CONTRASEÑA
// ========================================
const enviarEmailRecuperacion = async (email, nombre, token) => {
  const urlRecuperacion = `${process.env.FRONTEND_URL}/restablecer-contraseña/${token}`;

  const mailOptions = {
    from: `"Detodo en Cursos Pro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔑 Recupera tu contraseña - Detodo en Cursos Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #00ff88 0%, #00cc6e 100%);
            color: #0a0a0a;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .btn {
            display: inline-block;
            background: #00ff88;
            color: #0a0a0a;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffa500;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔑 Recuperación de Contraseña</h1>
        </div>
        <div class="content">
          <h2>Hola ${nombre},</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz click en el botón de abajo:</p>
          
          <div style="text-align: center;">
            <a href="${urlRecuperacion}" class="btn">Restablecer Contraseña</a>
          </div>
          
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #00ff88;">${urlRecuperacion}</p>
          
          <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul>
              <li>Este enlace expira en 1 hora</li>
              <li>Solo puede usarse una vez</li>
              <li>Si no solicitaste esto, ignora este email</li>
            </ul>
          </div>
          
          <p>Por tu seguridad, te recomendamos usar una contraseña fuerte que incluya mayúsculas, números y caracteres especiales.</p>
        </div>
        <div class="footer">
          <p>© 2025 Detodo en Cursos Pro. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

// ========================================
// 📧 EMAIL DE COMPRA APROBADA
// ========================================
const enviarEmailCompraAprobada = async (email, nombre, cursos) => {
  const listaCursos = cursos.map(curso => `<li>${curso.titulo}</li>`).join('');

  const mailOptions = {
    from: `"Detodo en Cursos Pro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '✅ Tu compra ha sido aprobada - Detodo en Cursos Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #00ff88 0%, #00cc6e 100%);
            color: #0a0a0a;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .btn {
            display: inline-block;
            background: #00ff88;
            color: #0a0a0a;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
          }
          ul {
            background: white;
            padding: 20px;
            border-radius: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 ¡Tu pago ha sido aprobado!</h1>
        </div>
        <div class="content">
          <h2>Hola ${nombre},</h2>
          <p>¡Excelentes noticias! Tu pago ha sido verificado y aprobado exitosamente.</p>
          
          <p><strong>Ya puedes acceder a tus cursos:</strong></p>
          <ul>
            ${listaCursos}
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}/mis-cursos-aprender" class="btn">Ver Mis Cursos</a>
          </div>
          
          <p>¡Comienza tu aprendizaje ahora mismo y alcanza tus metas! 🚀</p>
        </div>
        <div class="footer">
          <p>© 2025 Detodo en Cursos Pro. Todos los derechos reservados.</p>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  enviarEmailVerificacion,
  enviarEmailRecuperacion,
  enviarEmailCompraAprobada
};
