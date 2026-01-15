const express = require('express');
const router = express.Router();
const { auth, esAdmin } = require('../middleware/auth');
const { enviarEmailMasivo } = require('../services/emailMasivo');
const Curso = require('../models/Curso');

// Enviar email masivo (solo admin)
router.post('/enviar', auth, esAdmin, async (req, res) => {
  try {
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
        count = await Usuario.countDocuments({
          emailVerificado: true,
          'cursosComprados.curso': cursoId
        });
        break;

      case 'categoria':
        const cursos = await Curso.find({ categoria }).select('_id');
        const cursosIds = cursos.map(c => c._id);
        count = await Usuario.countDocuments({
          emailVerificado: true,
          'cursosComprados.curso': { $in: cursosIds }
        });
        break;
    }

    res.json({ destinatarios: count });
  } catch (error) {
    console.error('Error previsualizando:', error);
    res.status(500).json({ error: 'Error al previsualizar destinatarios' });
  }
});

module.exports = router;