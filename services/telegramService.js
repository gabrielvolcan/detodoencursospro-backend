// backend/services/telegramService.js
// Notificaciones a Telegram sin dependencias externas (usa https nativo de Node)

const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

/**
 * Envía un mensaje al chat de Telegram configurado.
 * No lanza error si falla — solo loguea — para no interrumpir el flujo principal.
 */
const enviarMensaje = (texto) => {
  if (!BOT_TOKEN || !CHAT_ID) {
    // Telegram no configurado → saltar silenciosamente
    return;
  }

  const body = JSON.stringify({
    chat_id: CHAT_ID,
    text: texto,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, (res) => {
    // Solo loguear si falla
    if (res.statusCode !== 200) {
      console.warn(`⚠️ Telegram respondió con status ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    console.warn('⚠️ Error enviando notificación Telegram:', err.message);
  });

  req.write(body);
  req.end();
};

// ========================================
// PLANTILLAS DE MENSAJES
// ========================================

const notificarNuevaCompra = ({ nombre, email, total, moneda, metodo, cursos, pais }) => {
  const cursosTexto = cursos?.map(c => `  • ${c}`).join('\n') || '  • (sin detalle)';
  const mensaje =
`🛒 <b>¡NUEVA COMPRA!</b>

👤 <b>Cliente:</b> ${nombre}
📧 <b>Email:</b> ${email}
🌎 <b>País:</b> ${pais || 'No especificado'}

📚 <b>Cursos:</b>
${cursosTexto}

💰 <b>Total:</b> ${total} ${moneda}
💳 <b>Método:</b> ${metodo}

⏳ <i>Esperando comprobante...</i>
━━━━━━━━━━━━━━━━━━━
🔗 Ir al admin: https://www.detodoencursos.com/admin`;

  enviarMensaje(mensaje);
};

const notificarComprobanteSubido = ({ nombre, email, total, moneda, metodo, compraId }) => {
  const mensaje =
`📎 <b>COMPROBANTE SUBIDO</b>

👤 <b>Cliente:</b> ${nombre}
📧 <b>Email:</b> ${email}
💰 <b>Total:</b> ${total} ${moneda}
💳 <b>Método:</b> ${metodo}

✅ <i>Revisar y aprobar en el panel admin</i>
━━━━━━━━━━━━━━━━━━━
🔗 Ir al admin: https://www.detodoencursos.com/admin`;

  enviarMensaje(mensaje);
};

const notificarPagoAprobado = ({ nombre, email, total, moneda, cursos }) => {
  const cursosTexto = cursos?.map(c => `  • ${c}`).join('\n') || '  • (sin detalle)';
  const mensaje =
`✅ <b>PAGO APROBADO</b>

👤 <b>Cliente:</b> ${nombre}
📧 <b>Email:</b> ${email}

📚 <b>Acceso otorgado a:</b>
${cursosTexto}

💰 <b>Total cobrado:</b> ${total} ${moneda}
🎉 <i>El cliente ya tiene acceso a sus cursos</i>`;

  enviarMensaje(mensaje);
};

const notificarPagoRechazado = ({ nombre, email, total, moneda, motivo }) => {
  const mensaje =
`❌ <b>PAGO RECHAZADO</b>

👤 <b>Cliente:</b> ${nombre}
📧 <b>Email:</b> ${email}
💰 <b>Total:</b> ${total} ${moneda}
📝 <b>Motivo:</b> ${motivo || 'No especificado'}

<i>Se envió email de rechazo al cliente</i>`;

  enviarMensaje(mensaje);
};

const notificarPagoStripe = ({ nombre, email, total, cursos }) => {
  const cursosTexto = cursos?.map(c => `  • ${c}`).join('\n') || '  • (sin detalle)';
  const mensaje =
`💳 <b>PAGO STRIPE EXITOSO</b>

👤 <b>Cliente:</b> ${nombre}
📧 <b>Email:</b> ${email}

📚 <b>Cursos desbloqueados:</b>
${cursosTexto}

💰 <b>Total:</b> $${total} USD
🤖 <i>Aprobado automáticamente por Stripe</i>`;

  enviarMensaje(mensaje);
};

module.exports = {
  notificarNuevaCompra,
  notificarComprobanteSubido,
  notificarPagoAprobado,
  notificarPagoRechazado,
  notificarPagoStripe
};
