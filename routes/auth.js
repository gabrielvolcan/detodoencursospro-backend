const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');

// Registro
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Crear nuevo usuario
    const usuario = new Usuario({
      nombre,
      email,
      password,
      telefono: telefono || ''
    });

    await usuario.save();

    // Generar token
    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.status(201).json({
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
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

    // Generar token
    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.json({
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener perfil
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

// Actualizar perfil
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
        rol: usuario.rol
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener mis cursos (cursos comprados por el usuario)
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
