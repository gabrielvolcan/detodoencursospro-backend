// backend/middleware/security.js
const rateLimit = require('express-rate-limit');

// ========================================
// 🛡️ RATE LIMITERS
// ========================================

/**
 * Límite general para toda la API.
 * 200 requests por IP cada 15 minutos.
 * Bloquea scrapers y bots básicos.
 */
const limitadorGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo en 15 minutos.'
  }
});

/**
 * Límite estricto para login.
 * 10 intentos por IP cada 15 minutos.
 * Evita fuerza bruta de contraseñas.
 */
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.'
  },
  skipSuccessfulRequests: true // No cuenta los intentos exitosos
});

/**
 * Límite para registro.
 * 5 registros por IP cada hora.
 * Evita creación masiva de cuentas (bots de spam).
 */
const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados registros desde esta IP. Intenta de nuevo en 1 hora.'
  }
});

/**
 * Límite para recuperación de contraseña.
 * 5 intentos por IP cada hora.
 * Evita spam de emails de recuperación.
 */
const limitadorRecuperacion = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes de recuperación. Espera 1 hora e intenta de nuevo.'
  }
});

/**
 * Límite para subida de archivos (comprobantes).
 * 10 subidas por IP cada hora.
 */
const limitadorSubidaArchivos = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas subidas de archivos. Espera 1 hora.'
  }
});

/**
 * Límite para envío masivo de emails (operación cara).
 * 3 envíos por hora — evita quemar la cuota/reputación del proveedor SMTP
 * por clicks repetidos o un admin comprometido.
 */
const limitadorEmailMasivo = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados envíos masivos. Espera 1 hora antes de enviar otra campaña.'
  }
});

// ========================================
// 🧹 SANITIZACIÓN DE INPUTS
// ========================================

/**
 * Escapa entidades HTML para interpolar de forma segura datos del usuario
 * dentro de plantillas HTML (emails). Previene inyección de HTML/phishing.
 */
const escaparHtml = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Valida formato de email.
 */
const esEmailValido = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

module.exports = {
  limitadorGeneral,
  limitadorLogin,
  limitadorRegistro,
  limitadorRecuperacion,
  limitadorSubidaArchivos,
  limitadorEmailMasivo,
  esEmailValido,
  escaparHtml
};
