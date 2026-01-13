const express = require('express');
const router = express.Router();
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const { auth, esAdmin } = require('../middleware/auth');

// Obtener todos los cursos (público) con filtros
router.get('/', async (req, res) => {
  try {
    const { categoria, nivel, busqueda, destacados } = req.query;
    
    let filtro = { activo: true };
    
    if (categoria && categoria !== 'Todos') {
      filtro.categoria = categoria;
    }
    
    if (nivel && nivel !== 'Todos') {
      filtro.nivel = nivel;
    }
    
    if (destacados === 'true') {
      filtro.destacado = true;
    }
    
    if (busqueda) {
      filtro.$or = [
        { titulo: { $regex: busqueda, $options: 'i' } },
        { descripcion: { $regex: busqueda, $options: 'i' } },
        { descripcionCorta: { $regex: busqueda, $options: 'i' } }
      ];
    }
    
    const cursos = await Curso.find(filtro).sort({ destacado: -1, createdAt: -1 });
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un curso por ID (público)
router.get('/:id', async (req, res) => {
  try {
    const curso = await Curso.findById(req.params.id);
    
    if (!curso || !curso.activo) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }
    
    res.json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener categorías únicas
router.get('/meta/categorias', async (req, res) => {
  try {
    const categorias = await Curso.distinct('categoria', { activo: true });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener niveles únicos
router.get('/meta/niveles', async (req, res) => {
  try {
    const niveles = await Curso.distinct('nivel', { activo: true });
    res.json(niveles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🎥 REPRODUCTOR DE VIDEOS - RUTAS NUEVAS
// ========================================

// Obtener curso para aprender (con verificación de compra)
router.get('/:id/aprender', auth, async (req, res) => {
  try {
    const curso = await Curso.findById(req.params.id);
    if (!curso) {
      return res.status(404).json({ mensaje: 'Curso no encontrado' });
    }

    // Verificar que el usuario compró el curso
    const usuario = await Usuario.findById(req.usuario._id);
    const cursoComprado = usuario.cursosComprados.find(
      c => c.curso.toString() === req.params.id
    );

    if (!cursoComprado) {
      return res.status(403).json({ mensaje: 'No tienes acceso a este curso' });
    }

    // Devolver curso con progreso del usuario
    res.json({
      curso,
      progreso: {
        videosVistos: cursoComprado.progresoVideos || [],
        completado: cursoComprado.completado || false,
        porcentaje: calcularPorcentaje(curso, cursoComprado.progresoVideos || [])
      }
    });
  } catch (error) {
    console.error('Error obteniendo curso:', error);
    res.status(500).json({ mensaje: 'Error al obtener el curso' });
  }
});

// Marcar video como visto
router.post('/:cursoId/marcar-visto', auth, async (req, res) => {
  try {
    const { temaId } = req.body;
    const { cursoId } = req.params;

    const usuario = await Usuario.findById(req.usuario._id);
    const cursoComprado = usuario.cursosComprados.find(
      c => c.curso.toString() === cursoId
    );

    if (!cursoComprado) {
      return res.status(403).json({ mensaje: 'No tienes acceso a este curso' });
    }

    // Agregar temaId si no existe
    if (!cursoComprado.progresoVideos.includes(temaId)) {
      cursoComprado.progresoVideos.push(temaId);
    }

    // Verificar si completó el curso
    const curso = await Curso.findById(cursoId);
    const totalTemas = contarTotalTemas(curso);
    const videosVistos = cursoComprado.progresoVideos.length;

    // ========================================
    // 🎓 AUTO-COMPLETAR CURSO Y GENERAR CERTIFICADO
    // ========================================
    if (videosVistos >= totalTemas && !cursoComprado.completado) {
      cursoComprado.completado = true;
      cursoComprado.fechaCompletado = new Date(); // ← CRÍTICO
      cursoComprado.certificado.generado = false; // Se generará cuando lo descargue
    }

    await usuario.save();

    res.json({
      mensaje: 'Progreso actualizado',
      progreso: {
        videosVistos: cursoComprado.progresoVideos,
        completado: cursoComprado.completado,
        porcentaje: (videosVistos / totalTemas) * 100
      }
    });
  } catch (error) {
    console.error('Error marcando video:', error);
    res.status(500).json({ mensaje: 'Error al actualizar progreso' });
  }
});

// Desmarcar video como visto
router.post('/:cursoId/desmarcar-visto', auth, async (req, res) => {
  try {
    const { temaId } = req.body;
    const { cursoId } = req.params;

    const usuario = await Usuario.findById(req.usuario._id);
    const cursoComprado = usuario.cursosComprados.find(
      c => c.curso.toString() === cursoId
    );

    if (!cursoComprado) {
      return res.status(403).json({ mensaje: 'No tienes acceso a este curso' });
    }

    // Remover temaId del array
    cursoComprado.progresoVideos = cursoComprado.progresoVideos.filter(
      id => id !== temaId
    );

    // Si desmarca, ya no está completado
    if (cursoComprado.completado) {
      cursoComprado.completado = false;
    }

    await usuario.save();

    const curso = await Curso.findById(cursoId);
    const totalTemas = contarTotalTemas(curso);
    const videosVistos = cursoComprado.progresoVideos.length;

    res.json({
      mensaje: 'Video desmarcado',
      progreso: {
        videosVistos: cursoComprado.progresoVideos,
        completado: cursoComprado.completado,
        porcentaje: (videosVistos / totalTemas) * 100
      }
    });
  } catch (error) {
    console.error('Error desmarcando video:', error);
    res.status(500).json({ mensaje: 'Error al actualizar progreso' });
  }
});

// ========================================
// 🎓 OBTENER CERTIFICADO (MEJORADO)
// ========================================
router.get('/:id/certificado', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id);
    const curso = await Curso.findById(req.params.id);

    // Validación 1: Curso existe
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    // Validación 2: Usuario compró el curso
    const cursoComprado = usuario.cursosComprados.find(
      c => c.curso.toString() === curso._id.toString()
    );

    if (!cursoComprado) {
      return res.status(403).json({ error: 'No has comprado este curso' });
    }

    // Validación 3: Curso completado
    if (!cursoComprado.completado) {
      return res.status(400).json({ 
        error: 'Debes completar el curso para obtener el certificado',
        progreso: {
          videosVistos: cursoComprado.progresoVideos?.length || 0,
          totalVideos: contarTotalTemas(curso)
        }
      });
    }

    // ========================================
    // 🛡️ VALIDACIÓN Y GENERACIÓN DEFENSIVA
    // ========================================
    
    // Si no tiene fechaCompletado, usar fecha actual
    if (!cursoComprado.fechaCompletado) {
      cursoComprado.fechaCompletado = new Date();
    }

    // Inicializar certificado si no existe
    if (!cursoComprado.certificado) {
      cursoComprado.certificado = {};
    }

    // Generar código de certificado si no existe
    if (!cursoComprado.certificado.codigoCertificado) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9).toUpperCase();
      cursoComprado.certificado.codigoCertificado = `DTC-${timestamp}-${random}`;
      cursoComprado.certificado.generado = true;
      cursoComprado.certificado.fechaGeneracion = new Date();
      await usuario.save();
    }

    // Respuesta exitosa
    res.json({
      nombreEstudiante: usuario.nombre || 'Estudiante',
      nombreCurso: curso.titulo,
      fechaCompletado: cursoComprado.fechaCompletado,
      codigoCertificado: cursoComprado.certificado.codigoCertificado,
      duracionCurso: curso.duracion || 'N/A',
      categoria: curso.categoria || 'General'
    });
  } catch (error) {
    console.error('❌ Error obteniendo certificado:', error);
    res.status(500).json({ 
      error: 'Error al generar el certificado',
      detalle: error.message 
    });
  }
});

// ========================================
// RUTAS DE ADMIN
// ========================================

// Crear curso (solo admin)
router.post('/', auth, esAdmin, async (req, res) => {
  try {
    const curso = new Curso(req.body);
    await curso.save();
    res.status(201).json(curso);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar curso (solo admin) - ✅ CORREGIDO para ejecutar middleware
router.put('/:id', auth, esAdmin, async (req, res) => {
  try {
    // Usar findById + save en lugar de findByIdAndUpdate
    // para que se ejecute el middleware pre('save')
    const curso = await Curso.findById(req.params.id);
    
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    // Actualizar campos
    Object.assign(curso, req.body);
    
    // Guardar (esto ejecuta el middleware pre-save que calcula precios)
    await curso.save();
    
    res.json(curso);
  } catch (error) {
    console.error('Error actualizando curso:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar curso (solo admin - soft delete)
router.delete('/:id', auth, esAdmin, async (req, res) => {
  try {
    const curso = await Curso.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );
    
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }
    
    res.json({ mensaje: 'Curso desactivado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🔧 FUNCIONES AUXILIARES
// ========================================

function contarTotalTemas(curso) {
  let total = 0;
  if (curso.temario && curso.temario.length > 0) {
    curso.temario.forEach(modulo => {
      if (modulo.temas && modulo.temas.length > 0) {
        total += modulo.temas.length;
      }
    });
  }
  return total;
}

function calcularPorcentaje(curso, videosVistos) {
  const total = contarTotalTemas(curso);
  if (total === 0) return 0;
  return Math.round((videosVistos.length / total) * 100);
}

module.exports = router;
