const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const Curso = require('../models/Curso');

// Configurar transporter (usa tu configuración existente)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Plantillas de email
const plantillas = {
  nuevoCurso: (curso) => ({
    asunto: `🚀 Nuevo Curso Disponible: ${curso.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">¡Nuevo Curso Disponible!</h2>
        <h3>${curso.titulo}</h3>
        <p>${curso.descripcionCorta}</p>
        <p><strong>Categoría:</strong> ${curso.categoria}</p>
        <p><strong>Nivel:</strong> ${curso.nivel}</p>
        <a href="${process.env.FRONTEND_URL}/curso/${curso._id}" 
           style="display: inline-block; background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Ver Curso
        </a>
      </div>
    `
  }),

  descuento: (porcentaje, cursoId) => ({
    asunto: `🎉 ¡${porcentaje}% de Descuento en Cursos Seleccionados!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">¡Oferta Especial!</h2>
        <p>Aprovecha nuestro descuento del <strong>${porcentaje}%</strong> en cursos seleccionados.</p>
        <p>Esta oferta es por tiempo limitado. ¡No te la pierdas!</p>
        <a href="${process.env.FRONTEND_URL}/cursos" 
           style="display: inline-block; background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Ver Cursos
        </a>
      </div>
    `
  }),

  actualizacion: (curso) => ({
    asunto: `📚 Actualización de Contenido: ${curso.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">¡Contenido Nuevo Agregado!</h2>
        <p>Hemos actualizado el curso <strong>${curso.titulo}</strong> con nuevo contenido.</p>
        <p>Ve a tu área de estudiante para ver las novedades.</p>
        <a href="${process.env.FRONTEND_URL}/aprender/${curso._id}" 
           style="display: inline-block; background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Ir al Curso
        </a>
      </div>
    `
  }),

  personalizado: (asunto, mensaje) => ({
    asunto,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${process.env.FRONTEND_URL}/images/letras_y_eslogan.webp" alt="Detodo Cursos" style="max-width: 200px; margin-bottom: 20px;">
        <div style="white-space: pre-wrap;">${mensaje}</div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          Este email fue enviado desde Detodo Cursos.<br>
          Si no deseas recibir más emails, 
          <a href="${process.env.FRONTEND_URL}/configuracion" style="color: #00ff88;">actualiza tus preferencias aquí</a>.
        </p>
      </div>
    `
  })
};

// Función principal de envío masivo
const enviarEmailMasivo = async (opciones) => {
  const {
    tipo, // 'todos', 'conCursos', 'cursoEspecifico', 'categoria'
    plantilla, // 'nuevoCurso', 'descuento', 'actualizacion', 'personalizado'
    asunto,
    mensaje,
    cursoId,
    categoria,
    datosAdicionales
  } = opciones;

  try {
    // 1. Obtener destinatarios según el tipo
    let usuarios = [];

    switch (tipo) {
      case 'todos':
        usuarios = await Usuario.find({ emailVerificado: true }).select('email nombre');
        break;

      case 'conCursos':
        usuarios = await Usuario.find({
          emailVerificado: true,
          'cursosComprados.0': { $exists: true }
        }).select('email nombre');
        break;

      case 'cursoEspecifico':
        usuarios = await Usuario.find({
          emailVerificado: true,
          'cursosComprados.curso': cursoId
        }).select('email nombre');
        break;

      case 'categoria':
        const cursos = await Curso.find({ categoria }).select('_id');
        const cursosIds = cursos.map(c => c._id);
        usuarios = await Usuario.find({
          emailVerificado: true,
          'cursosComprados.curso': { $in: cursosIds }
        }).select('email nombre');
        break;

      default:
        throw new Error('Tipo de destinatario no válido');
    }

    if (usuarios.length === 0) {
      return { exito: false, mensaje: 'No hay destinatarios para enviar' };
    }

    // 2. Generar contenido del email según plantilla
    let contenidoEmail;

    if (plantilla === 'personalizado') {
      contenidoEmail = plantillas.personalizado(asunto, mensaje);
    } else {
      contenidoEmail = plantillas[plantilla](datosAdicionales);
    }

    // 3. Enviar emails en lotes (para no sobrecargar)
    const LOTE = 50;
    let enviados = 0;
    let errores = 0;

    for (let i = 0; i < usuarios.length; i += LOTE) {
      const lote = usuarios.slice(i, i + LOTE);

      const promesas = lote.map(usuario =>
        transporter.sendMail({
          from: `"Detodo Cursos" <${process.env.EMAIL_USER}>`,
          to: usuario.email,
          subject: contenidoEmail.asunto,
          html: contenidoEmail.html
        })
        .then(() => {
          enviados++;
          console.log(`✅ Email enviado a ${usuario.email}`);
        })
        .catch((error) => {
          errores++;
          console.error(`❌ Error enviando a ${usuario.email}:`, error.message);
        })
      );

      await Promise.all(promesas);

      // Esperar 2 segundos entre lotes para no saturar
      if (i + LOTE < usuarios.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return {
      exito: true,
      mensaje: `Emails enviados exitosamente`,
      estadisticas: {
        total: usuarios.length,
        enviados,
        errores
      }
    };

  } catch (error) {
    console.error('❌ Error en envío masivo:', error);
    throw error;
  }
};

module.exports = {
  enviarEmailMasivo,
  plantillas
};