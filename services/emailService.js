const nodemailer = require('nodemailer');

// Configurar transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const enviarEmailAprobacion = async (usuario, cursos, compra) => {
  const listaCursos = cursos.map(c => `• ${c.titulo}`).join('\n');
  
  const mailOptions = {
    from: `"detodoencursospro" <${process.env.EMAIL_USER}>`,
    to: usuario.email,
    subject: '¡Tu pago ha sido aprobado! - Accede a tus cursos',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00ff88 0%, #00cc6e 100%); color: #000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #00ff88; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .credentials { background: #fff; padding: 20px; border-left: 4px solid #00ff88; margin: 20px 0; }
          .course-list { background: #fff; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Pago Aprobado!</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${usuario.nombre}</strong>,</p>
            
            <p>¡Excelentes noticias! Tu pago ha sido verificado y aprobado exitosamente.</p>
            
            <div class="credentials">
              <h3>📚 Tus Credenciales de Acceso</h3>
              <p><strong>Email:</strong> ${usuario.email}</p>
              <p><strong>Contraseña:</strong> La que creaste al registrarte</p>
            </div>
            
            <div class="course-list">
              <h3>📖 Cursos Disponibles:</h3>
              <pre>${listaCursos}</pre>
            </div>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/login" class="button">
                Acceder a Mis Cursos
              </a>
            </p>
            
            <p><strong>Total Pagado:</strong> $${compra.total.toFixed(2)} ${compra.moneda}</p>
            
            <p>Una vez que inicies sesión, encontrarás tus cursos en la sección "Mis Cursos".</p>
            
            <p>Al completar cada curso, recibirás automáticamente tu <strong>certificado de finalización</strong>.</p>
            
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            
            <p>¡Disfruta tu aprendizaje!<br>
            <strong>Equipo de detodoencursospro</strong></p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} detodoencursospro. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado a ${usuario.email}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
};

const enviarEmailRechazo = async (usuario, motivo) => {
  const mailOptions = {
    from: `"detodoencursospro" <${process.env.EMAIL_USER}>`,
    to: usuario.email,
    subject: 'Información sobre tu pago - detodoencursospro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff3366; color: #fff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #fff; padding: 20px; border-left: 4px solid #ff3366; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Actualización de tu Pago</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${usuario.nombre}</strong>,</p>
            
            <div class="alert">
              <p>Lamentablemente no pudimos verificar tu pago.</p>
              <p><strong>Motivo:</strong> ${motivo || 'Comprobante inválido o ilegible'}</p>
            </div>
            
            <p>Por favor, verifica lo siguiente:</p>
            <ul>
              <li>El comprobante sea legible</li>
              <li>El monto coincida con el curso</li>
              <li>Los datos de transferencia sean correctos</li>
            </ul>
            
            <p>Puedes intentar subir nuevamente el comprobante desde tu panel de usuario.</p>
            
            <p>Si necesitas ayuda, contáctanos y te asistiremos.</p>
            
            <p>Saludos,<br>
            <strong>Equipo de detodoencursospro</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de rechazo enviado a ${usuario.email}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
};

module.exports = {
  enviarEmailAprobacion,
  enviarEmailRechazo
};
