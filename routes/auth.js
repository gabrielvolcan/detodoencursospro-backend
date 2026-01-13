const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { enviarEmailVerificacion, enviarEmailRecuperacion } = require('../services/emailService');

// ========================================
// 📝 REGISTRO CON EMAIL DE VERIFICACIÓN (SIN TOKEN INMEDIATO)
// ========================================
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ email });
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

    // ✅ RESPONDER SIN TOKEN (usuario debe verificar primero)
    res.status(201).json({
      mensaje: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
      emailEnviado: true
    });

    // 📧 ENVIAR EMAIL EN BACKGROUND
    enviarEmailVerificacion(email, nombre, tokenVerificacion).catch(err => 
      console.error('❌ Error enviando email de verificación:', err)
    );

  } catch (error) {
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await Usuario.findOne({ email });
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
// 🔑 SOLICITAR RECUPERACIÓN DE CONTRASEÑA (OPTIMIZADO)
// ========================================
router.post('/recuperar-contraseña', async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      // Por seguridad, no revelar si el email existe
      return res.json({ mensaje: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' });
    }

    // Generar token de recuperación
    const tokenRecuperacion = crypto.randomBytes(32).toString('hex');
    usuario.resetPasswordToken = tokenRecuperacion;
    usuario.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hora

    await usuario.save();

    // ✅ RESPONDER INMEDIATAMENTE
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
router.post('/restablecer-contraseña/:token', async (req, res) => {
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
// 📚 OBTENER MIS CURSOS
// ========================================
router.get('/usuarios/mis-cursos', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
      .populate({
        path: 'cursosComprados.curso',
        select: 'titulo imagen categoria nivel duracion temario'
      });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuario.cursosComprados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
