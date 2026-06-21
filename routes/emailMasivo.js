const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth, esAdmin } = require('../middleware/auth');
const { enviarEmailMasivo } = require('../services/emailMasivo');
const { limitadorEmailMasivo } = require('../middleware/security');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');

const TIPOS_VALIDOS = ['todos', 'conCursos', 'cursoEspecifico', 'categoria'];

// Enviar email masivo (solo admin) — con rate limit estricto para no abusar del proveedor SMTP
router.post('/enviar', auth, esAdmin, limitadorEmailMasivo, async (req, res) => {
  try {
    const { tipo } = req.body;
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de destinatario no válido' });
    }
    const resultado = await enviarEmailMasivo(req.body);
    res.json(resultado);
  } catch (error) {
    console.error('Error enviando emails:', error);
    res.status(500).json({ error: 'Error al enviar emails masivos' });
  }
});

// Obtener estadísticas de destinatarios
router.post('/previsualizar', auth, esAdmin, async (req, res) => {
  try {
    const { tipo, cursoId, categoria } = req.body;

    let count = 0;

    switch (tipo) {
      case 'todos':
        count = await Usuario.countDocuments({ emailVerificado: true });
        break;

      case 'conCursos':
        count = await Usuario.countDocuments({
          emailVerificado: true,
          'cursosComprados.0': { $exists: true }
        });
        break;

      case 'cursoEspecifico':
        if (!mongoose.Types.ObjectId.isValid(cursoId)) {
          return res.status(400).json({ error: 'cursoId no válido' });
        }
        count = await Usuario.countDocuments({
          emailVerificado: true,
          'cursosComprados.curso': cursoId
        });
        break;

      case 'categoria': {
        const cursos = await Curso.find({ categoria: String(categoria || '') }).select('_id');
        const cursosIds = cursos.map(c => c._id);
        count = await Usuario.countDocuments({
          emailVerificado: true,
          'cursosComprados.curso': { $in: cursosIds }
        });
        break;
      }

      default:
        return res.status(400).json({ error: 'Tipo de destinatario no válido' });
    }

    res.json({ destinatarios: count });
  } catch (error) {
    console.error('Error previsualizando:', error);
    res.status(500).json({ error: 'Error al previsualizar destinatarios' });
  }
});

module.exports = router;
