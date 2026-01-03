const express = require('express');
const router = express.Router();
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Compra = require('../models/Compra');
const { auth, esAdmin } = require('../middleware/auth');
const { enviarEmailAprobacion, enviarEmailRechazo } = require('../services/emailService');

// Dashboard - estadísticas generales
router.get('/dashboard', auth, esAdmin, async (req, res) => {
  try {
    const totalCursos = await Curso.countDocuments({ activo: true });
    const totalUsuarios = await Usuario.countDocuments({ rol: 'usuario' });
    const ventasCompletadas = await Compra.countDocuments({ estadoPago: 'aprobado' });
    
    const ingresos = await Compra.aggregate([
      { $match: { estadoPago: 'aprobado' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const ingresosTotal = ingresos.length > 0 ? ingresos[0].total : 0;
    
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    
    const ventasMes = await Compra.countDocuments({
      estadoPago: 'aprobado',
      createdAt: { $gte: inicioMes }
    });
    
    const ingresosMes = await Compra.aggregate([
      { 
        $match: { 
          estadoPago: 'aprobado',
          createdAt: { $gte: inicioMes }
        } 
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const ingresosMesTotal = ingresosMes.length > 0 ? ingresosMes[0].total : 0;
    
    const cursosPopulares = await Curso.find({ activo: true })
      .sort({ estudiantes: -1 })
      .limit(5)
      .select('titulo estudiantes precio imagen');
    
    const ultimasVentas = await Compra.find({ estadoPago: 'aprobado' })
      .populate('usuario', 'nombre email')
      .populate('cursos.curso', 'titulo')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      estadisticas: {
        totalCursos,
        totalUsuarios,
        ventasCompletadas,
        ingresosTotal,
        ventasMes,
        ingresosMesTotal
      },
      cursosPopulares,
      ultimasVentas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los cursos (para admin)
router.get('/cursos', auth, esAdmin, async (req, res) => {
  try {
    const cursos = await Curso.find().sort({ createdAt: -1 });
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las ventas
router.get('/ventas', auth, esAdmin, async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;
    
    let filtro = {};
    
    if (estado) {
      filtro.estadoPago = estado;
    }
    
    if (desde || hasta) {
      filtro.createdAt = {};
      if (desde) filtro.createdAt.$gte = new Date(desde);
      if (hasta) filtro.createdAt.$lte = new Date(hasta);
    }
    
    const ventas = await Compra.find(filtro)
      .populate('usuario', 'nombre email telefono')
      .populate('cursos.curso', 'titulo imagen')
      .sort({ createdAt: -1 });
    
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los usuarios
router.get('/usuarios', auth, esAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar rol de usuario
router.put('/usuario/:id/rol', auth, esAdmin, async (req, res) => {
  try {
    const { rol } = req.body;
    
    if (!['usuario', 'admin'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { rol },
      { new: true }
    ).select('-password');

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activar/desactivar usuario
router.patch('/usuarios/:id/estado', auth, esAdmin, async (req, res) => {
  try {
    const { activo } = req.body;
    
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { activo },
      { new: true }
    ).select('-password');
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener compras pendientes de aprobación
router.get('/compras-pendientes', auth, esAdmin, async (req, res) => {
  try {
    const compras = await Compra.find({
      estadoPago: { $in: ['pendiente', 'en_revision'] }
    })
      .populate('usuario', 'nombre email telefono')
      .populate('cursos.curso', 'titulo imagen precio')
      .sort({ createdAt: -1 });

    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aprobar pago
router.post('/aprobar-pago/:compraId', auth, esAdmin, async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.compraId)
      .populate('usuario')
      .populate('cursos.curso');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (compra.estadoPago === 'aprobado') {
      return res.status(400).json({ error: 'Esta compra ya fue aprobada' });
    }

    compra.estadoPago = 'aprobado';
    compra.fechaAprobacion = new Date();
    compra.aprobadoPor = req.usuario._id;
    await compra.save();

    const usuario = await Usuario.findById(compra.usuario._id);

    for (const item of compra.cursos) {
      const yaComprado = usuario.cursosComprados.some(
        c => c.curso.toString() === item.curso._id.toString()
      );

      if (!yaComprado) {
        usuario.cursosComprados.push({
          curso: item.curso._id,
          fechaCompra: new Date(),
          precioCompra: item.precio,
          progresoVideos: [],
          completado: false
        });

        await Curso.findByIdAndUpdate(item.curso._id, {
          $inc: { estudiantes: 1 }
        });
      }
    }

    await usuario.save();

    await enviarEmailAprobacion(usuario, compra.cursos.map(c => c.curso), compra);

    res.json({
      mensaje: 'Pago aprobado y email enviado al usuario',
      compra
    });
  } catch (error) {
    console.error('Error aprobando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rechazar pago
router.post('/rechazar-pago/:compraId', auth, esAdmin, async (req, res) => {
  try {
    const { motivo } = req.body;
    const compra = await Compra.findById(req.params.compraId)
      .populate('usuario');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    compra.estadoPago = 'rechazado';
    compra.notasAdmin = motivo || 'Comprobante inválido';
    await compra.save();

    await enviarEmailRechazo(compra.usuario, motivo);

    res.json({
      mensaje: 'Pago rechazado y usuario notificado',
      compra
    });
  } catch (error) {
    console.error('Error rechazando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🆕 NUEVAS RUTAS - GESTIÓN AVANZADA
// ========================================

// Editar usuario
router.put('/usuario/:id', auth, esAdmin, async (req, res) => {
  try {
    const { nombre, email, telefono, pais } = req.body;
    
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { nombre, email, telefono, pais },
      { new: true, runValidators: true }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar usuario
router.delete('/usuario/:id', auth, esAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir eliminar admin principal
    if (usuario.email === 'admin@securityacademy.com') {
      return res.status(403).json({ error: 'No se puede eliminar el administrador principal' });
    }

    await Usuario.findByIdAndDelete(req.params.id);
    
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quitar curso a usuario
router.delete('/usuario/:usuarioId/curso/:cursoId', auth, esAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    usuario.cursosComprados = usuario.cursosComprados.filter(
      c => c.curso.toString() !== req.params.cursoId
    );

    await usuario.save();

    // Decrementar contador de estudiantes del curso
    await Curso.findByIdAndUpdate(req.params.cursoId, {
      $inc: { estudiantes: -1 }
    });

    res.json({ mensaje: 'Curso removido del usuario' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las compras (con filtros)
router.get('/todas-compras', auth, esAdmin, async (req, res) => {
  try {
    const { estado, desde, hasta, usuario } = req.query;
    
    let filtro = {};
    
    if (estado && estado !== 'todas') {
      filtro.estadoPago = estado;
    }
    
    if (desde || hasta) {
      filtro.createdAt = {};
      if (desde) filtro.createdAt.$gte = new Date(desde);
      if (hasta) filtro.createdAt.$lte = new Date(hasta);
    }
    
    if (usuario) {
      filtro.usuario = usuario;
    }
    
    const compras = await Compra.find(filtro)
      .populate('usuario', 'nombre email telefono')
      .populate('cursos.curso', 'titulo imagen')
      .sort({ createdAt: -1 });
    
    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de compra
router.put('/compra/:id/estado', auth, esAdmin, async (req, res) => {
  try {
    const { estadoPago, notasAdmin } = req.body;
    
    const estadosValidos = ['pendiente', 'en_revision', 'aprobado', 'rechazado'];
    if (!estadosValidos.includes(estadoPago)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    const compra = await Compra.findByIdAndUpdate(
      req.params.id,
      { estadoPago, notasAdmin },
      { new: true }
    )
    .populate('usuario', 'nombre email')
    .populate('cursos.curso', 'titulo');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    res.json(compra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar compra
router.delete('/compra/:id', auth, esAdmin, async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id);
    
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    // Si la compra estaba aprobada, remover cursos del usuario
    if (compra.estadoPago === 'aprobado') {
      const usuario = await Usuario.findById(compra.usuario);
      
      if (usuario) {
        for (const item of compra.cursos) {
          usuario.cursosComprados = usuario.cursosComprados.filter(
            c => c.curso.toString() !== item.curso.toString()
          );
          
          // Decrementar estudiantes del curso
          await Curso.findByIdAndUpdate(item.curso, {
            $inc: { estudiantes: -1 }
          });
        }
        
        await usuario.save();
      }
    }

    await Compra.findByIdAndDelete(req.params.id);
    
    res.json({ mensaje: 'Compra eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
