const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { enviarEmailVerificacion, enviarEmailRecuperacion } = require('../services/emailService');
const {
  limitadorLogin,
  limitadorRegistro,
  limitadorRecuperacion,
  esEmailValido
} = require('../middleware/security');

// ========================================
// 📝 REGISTRO CON EMAIL DE VERIFICACIÓN + CURSO GRATUITO
// ========================================
router.post('/registro', limitadorRegistro, async (req, res) => {
  try {
    const { nombre, email, password, telefono, cursoGratuitoId } = req.body;

    // Validar campos obligatorios
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }

    // Validar formato de email
    if (!esEmailValido(email)) {
      return res.status(400).json({ error: 'El formato del email no es válido' });
    }

    // Limitar longitud de campos
    if (nombre.length > 100) {
      return res.status(400).json({ error: 'El nombre es demasiado largo' });
    }

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ email: email.toLowerCase() });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Validar contraseña fuerte
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula' });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos un número' });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos un carácter especial' });
    }

    // Generar token de verificación
    const tokenVerificacion = crypto.randomBytes(32).toString('hex');

    // Crear nuevo usuario
    const usuario = new Usuario({
      nombre,
      email,
      password,
      telefono: telefono || '',
      emailVerificado: false,
      tokenVerificacion,
      tokenVerificacionExpira: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
    });

    await usuario.save();

    // 🆕 INSCRIBIR AUTOMÁTICAMENTE AL CURSO GRATUITO SI EXISTE
    if (cursoGratuitoId) {
      try {
        const Curso = require('../models/Curso');
        const curso = await Curso.findById(cursoGratuitoId);
        
        if (curso && (curso.esGratuito === true || curso.precioUSD === 0)) {
          console.log('✅ Inscribiendo usuario al curso gratuito:', curso.titulo);
          
          usuario.cursosComprados.push({
            curso: curso._id,
            fechaCompra: new Date(),
            precio: 0,
            moneda: 'USD',
            metodoPago: 'Gratuito',
            estado: 'completado',
            progresoVideos: [],
            completado: false
          });
          
          await usuario.save();
          
          // Incrementar contador
          curso.estudiantes = (curso.estudiantes || 0) + 1;
          await curso.save();
          
          console.log('✅ Curso gratuito inscrito exitosamente');
        }
      } catch (error) {
        console.error('❌ Error inscribiendo curso gratuito:', error);
        // No detener el registro si falla la inscripción
      }
    }

    // ✅ RESPONDER SIN TOKEN (usuario debe verificar primero)
    res.status(201).json({
      mensaje: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
      emailEnviado: true,
      cursoGratuitoInscrito: !!cursoGratuitoId
    });

    // 📧 ENVIAR EMAIL EN BACKGROUND
    enviarEmailVerificacion(email, nombre, tokenVerificacion).catch(err => 
      console.error('❌ Error enviando email de verificación:', err)
    );

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// ✉️ VERIFICAR EMAIL
// ========================================
router.get('/verificar-email/:token', async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      tokenVerificacion: req.params.token,
      tokenVerificacionExpira: { $gt: Date.now() }
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    usuario.emailVerificado = true;
    usuario.tokenVerificacion = undefined;
    usuario.tokenVerificacionExpira = undefined;
    await usuario.save();

    res.json({ mensaje: 'Email verificado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🔐 LOGIN (REQUIERE EMAIL VERIFICADO)
// ========================================
router.post('/login', limitadorLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    if (!esEmailValido(email)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Buscar usuario
    const usuario = await Usuario.findOne({ email: email.toLowerCase() });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar password
    const passwordValido = await usuario.compararPassword(password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // ✅ VERIFICAR QUE EL EMAIL ESTÉ VERIFICADO
    if (!usuario.emailVerificado) {
      return res.status(403).json({ 
        error: 'Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.',
        emailVerificado: false
      });
    }

    // Generar token
    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.json({
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        emailVerificado: usuario.emailVerificado
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// 🔑 SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ========================================
router.post('/recuperar-contrasena', limitadorRecuperacion, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !esEmailValido(email)) {
      // Respuesta genérica para no confirmar si el email existe o no
      return res.json({ mensaje: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase() });
    if (!usuario) {
      return res.json({ mensaje: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' });
    }

    // Generar token de recuperación
    const tokenRecuperacion = crypto.randomBytes(32).toString('hex');
    usuario.resetPasswordToken = tokenRecuperacion;
    usuario.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hora

    await usuario.save();

    res.json({ mensaje: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' });

    // 📧 ENVIAR EMAIL EN BACKGROUND
    enviarEmailRecuperacion(email, usuario.nombre, tokenRecuperacion).catch(err => 
      console.error('❌ Error enviando email de recuperación:', err)
    );

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🔓 RESTABLECER CONTRASEÑA
// ========================================
router.post('/restablecer-contrasena/:token', async (req, res) => {
  try {
    const { password } = req.body;

    // Validar contraseña fuerte
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos una mayúscula' });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos un número' });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos un carácter especial' });
    }

    const usuario = await Usuario.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Actualizar contraseña
    usuario.password = password;
    usuario.resetPasswordToken = undefined;
    usuario.resetPasswordExpires = undefined;
    await usuario.save();

    res.json({ mensaje: 'Contraseña restablecida exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 👤 OBTENER PERFIL
// ========================================
router.get('/perfil', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
      .select('-password')
      .populate('cursosComprados.curso');
    
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ✏️ ACTUALIZAR PERFIL
// ========================================
router.patch('/perfil', auth, async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    
    const usuario = await Usuario.findById(req.usuario._id);
    
    if (nombre) usuario.nombre = nombre;
    if (telefono !== undefined) usuario.telefono = telefono;
    
    await usuario.save();
    
    res.json({
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        emailVerificado: usuario.emailVerificado
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// 📚 OBTENER MIS CURSOS (CORREGIDO)
// ========================================
router.get('/usuarios/mis-cursos', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
      .populate({
        path: 'cursosComprados.curso',
        select: 'titulo imagen categoria nivel duracion temario estudiantes'
      });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Filtrar solo cursos válidos
    const cursosValidos = usuario.cursosComprados.filter(c => c.curso !== null);

    res.json(cursosValidos);
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
