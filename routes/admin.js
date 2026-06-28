const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Compra = require('../models/Compra');
const Producto = require('../models/Producto');
const { auth, esAdmin } = require('../middleware/auth');
const { enviarEmailCompraAprobada, enviarEmailRechazo } = require('../services/emailService');
const { notificarPagoAprobado, notificarPagoRechazado } = require('../services/telegramService');

// Email del administrador principal (protegido). Configurable por entorno.
const ADMIN_PRINCIPAL_EMAIL = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();

// Acredita/desacredita los cursos Y productos de una compra al usuario según la
// transición de estado. Centraliza la lógica para que todos los caminos sean consistentes.
async function sincronizarCursosPorEstado(compra, estadoAnterior, estadoNuevo) {
  if (estadoAnterior === estadoNuevo) return;

  const usuario = await Usuario.findById(compra.usuario);
  if (!usuario) return;

  const cursosCompra = compra.cursos || [];
  const productosCompra = compra.productos || [];

  // Pasa a aprobado -> acreditar cursos y productos
  if (estadoNuevo === 'aprobado' && estadoAnterior !== 'aprobado') {
    for (const item of cursosCompra) {
      const cursoId = item.curso?._id || item.curso;
      const yaComprado = usuario.cursosComprados.some(
        c => c.curso.toString() === cursoId.toString()
      );
      if (!yaComprado) {
        usuario.cursosComprados.push({
          curso: cursoId,
          fechaCompra: new Date(),
          precioCompra: item.precio,
          progresoVideos: [],
          completado: false
        });
        await Curso.findByIdAndUpdate(cursoId, { $inc: { estudiantes: 1 } });
      }
    }

    if (!usuario.productosComprados) usuario.productosComprados = [];
    for (const item of productosCompra) {
      const prodId = item.producto?._id || item.producto;
      const yaComprado = usuario.productosComprados.some(
        p => (p.producto?.toString() === prodId.toString()) && p.estadoPago === 'aprobado'
      );
      if (!yaComprado) {
        usuario.productosComprados.push({
          producto: prodId,
          estadoPago: 'aprobado',
          fechaCompra: new Date(),
          precio: item.precio
        });
        await Producto.findByIdAndUpdate(prodId, { $inc: { totalCompradores: 1, totalVentas: 1 } });
      }
    }
    await usuario.save();
  }

  // Sale de aprobado -> remover cursos y productos de esta compra
  if (estadoAnterior === 'aprobado' && estadoNuevo !== 'aprobado') {
    for (const item of cursosCompra) {
      const cursoId = item.curso?._id || item.curso;
      const longitudPrevia = usuario.cursosComprados.length;
      usuario.cursosComprados = usuario.cursosComprados.filter(
        c => c.curso.toString() !== cursoId.toString()
      );
      if (usuario.cursosComprados.length < longitudPrevia) {
        await Curso.findByIdAndUpdate(cursoId, { $inc: { estudiantes: -1 } });
      }
    }

    for (const item of productosCompra) {
      const prodId = item.producto?._id || item.producto;
      const longitudPrevia = (usuario.productosComprados || []).length;
      usuario.productosComprados = (usuario.productosComprados || []).filter(
        p => p.producto?.toString() !== prodId.toString()
      );
      if (usuario.productosComprados.length < longitudPrevia) {
        await Producto.findByIdAndUpdate(prodId, { $inc: { totalCompradores: -1, totalVentas: -1 } });
      }
    }
    await usuario.save();
  }
}

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

    // 🆕 Pagos pendientes de aprobación
    const pagosPendientes = await Compra.countDocuments({
      estadoPago: { $in: ['pendiente', 'en_revision'] }
    });

    // 🆕 Mes anterior (para comparativas vs mes actual)
    const inicioMesAnterior = new Date(inicioMes);
    inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
    const ventasMesAnterior = await Compra.countDocuments({
      estadoPago: 'aprobado',
      createdAt: { $gte: inicioMesAnterior, $lt: inicioMes }
    });
    const ingMesAntAgg = await Compra.aggregate([
      { $match: { estadoPago: 'aprobado', createdAt: { $gte: inicioMesAnterior, $lt: inicioMes } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const ingresosMesAnterior = ingMesAntAgg.length ? ingMesAntAgg[0].total : 0;
    const usuariosMes = await Usuario.countDocuments({ rol: 'usuario', createdAt: { $gte: inicioMes } });
    const usuariosMesAnterior = await Usuario.countDocuments({
      rol: 'usuario',
      createdAt: { $gte: inicioMesAnterior, $lt: inicioMes }
    });

    // 🆕 Top productos por ingresos
    const productosIngresos = await Compra.aggregate([
      { $match: { estadoPago: 'aprobado' } },
      { $unwind: '$productos' },
      { $group: { _id: '$productos.producto', ingresos: { $sum: '$productos.precio' }, ventas: { $sum: 1 } } },
      { $sort: { ingresos: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $project: { _id: 1, ingresos: 1, ventas: 1, titulo: '$prod.titulo', imagen: '$prod.imagen' } }
    ]);

    // 🆕 Serie diaria de ventas (últimos 30 días) para el gráfico con filtro
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 29);
    hace30.setHours(0, 0, 0, 0);
    const ventasPorDia = await Compra.aggregate([
      { $match: { estadoPago: 'aprobado', createdAt: { $gte: hace30 } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
      } }
    ]);

    res.json({
      estadisticas: {
        totalCursos,
        totalUsuarios,
        ventasCompletadas,
        ingresosTotal,
        ventasMes,
        ingresosMesTotal,
        pagosPendientes,
        ventasMesAnterior,
        ingresosMesAnterior,
        usuariosMes,
        usuariosMesAnterior
      },
      cursosPopulares,
      productosIngresos,
      ultimasVentas,
      ventasPorDia
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
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
      const fDesde = desde ? new Date(desde) : null;
      const fHasta = hasta ? new Date(hasta) : null;
      if (fDesde && !isNaN(fDesde)) filtro.createdAt.$gte = fDesde;
      if (fHasta && !isNaN(fHasta)) filtro.createdAt.$lte = fHasta;
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

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
    }

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
      .populate('productos.producto', 'titulo imagen')
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
      .populate('cursos.curso')
      .populate('productos.producto');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (compra.estadoPago === 'aprobado') {
      return res.status(400).json({ error: 'Esta compra ya fue aprobada' });
    }

    const estadoAnterior = compra.estadoPago;
    compra.estadoPago = 'aprobado';
    compra.fechaAprobacion = new Date();
    compra.aprobadoPor = req.usuario._id;
    await compra.save();

    // Acreditar cursos y productos al usuario (lógica centralizada, consistente con cambiar-estado)
    await sincronizarCursosPorEstado(compra, estadoAnterior, 'aprobado');

    const usuario = compra.usuario; // poblado arriba; se usa para email y notificación

    // Email de aprobación (lista cursos y productos, y dirige al lugar correcto)
    await enviarEmailCompraAprobada(usuario, compra);

    // 📣 Notificar a Telegram
    notificarPagoAprobado({
      nombre: usuario.nombre,
      email:  usuario.email,
      total:  compra.total,
      moneda: compra.moneda,
      cursos: compra.cursos.map(c => c.curso?.titulo || 'Curso')
    });

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

    // 📣 Notificar a Telegram
    notificarPagoRechazado({
      nombre: compra.usuario?.nombre,
      email:  compra.usuario?.email,
      total:  compra.total,
      moneda: compra.moneda,
      motivo: motivo || 'Comprobante inválido'
    });

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

    // Whitelist de campos editables (no se acepta rol/activo/password por esta vía)
    const cambios = {};
    if (nombre !== undefined) cambios.nombre = String(nombre);
    if (telefono !== undefined) cambios.telefono = String(telefono);
    if (pais !== undefined) cambios.pais = String(pais);

    // Validación de email: formato + unicidad
    if (email !== undefined) {
      const emailNorm = String(email).toLowerCase().trim();
      const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!regexEmail.test(emailNorm)) {
        return res.status(400).json({ error: 'El formato del email no es válido' });
      }
      const enUso = await Usuario.findOne({ email: emailNorm, _id: { $ne: req.params.id } });
      if (enUso) {
        return res.status(400).json({ error: 'Ese email ya está en uso' });
      }
      cambios.email = emailNorm;
    }

    const objetivo = await Usuario.findById(req.params.id);
    if (!objetivo) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Proteger el email del administrador principal
    if (ADMIN_PRINCIPAL_EMAIL && objetivo.email === ADMIN_PRINCIPAL_EMAIL && cambios.email && cambios.email !== ADMIN_PRINCIPAL_EMAIL) {
      return res.status(403).json({ error: 'No se puede cambiar el email del administrador principal' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      cambios,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(usuario);
  } catch (error) {
    console.error('Error editando usuario:', error);
    res.status(500).json({ error: 'Error al editar el usuario' });
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
    if (ADMIN_PRINCIPAL_EMAIL && usuario.email === ADMIN_PRINCIPAL_EMAIL) {
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
      const fDesde = desde ? new Date(desde) : null;
      const fHasta = hasta ? new Date(hasta) : null;
      if (fDesde && !isNaN(fDesde)) filtro.createdAt.$gte = fDesde;
      if (fHasta && !isNaN(fHasta)) filtro.createdAt.$lte = fHasta;
    }

    if (usuario) {
      if (!mongoose.Types.ObjectId.isValid(usuario)) {
        return res.status(400).json({ error: 'Usuario no válido' });
      }
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

    const compra = await Compra.findById(req.params.id);
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const estadoAnterior = compra.estadoPago;
    compra.estadoPago = estadoPago;
    if (notasAdmin !== undefined) compra.notasAdmin = notasAdmin;
    await compra.save();

    // Acreditar/desacreditar cursos según la transición (consistencia con aprobar-pago)
    await sincronizarCursosPorEstado(compra, estadoAnterior, estadoPago);

    const compraActualizada = await Compra.findById(compra._id)
      .populate('usuario', 'nombre email')
      .populate('cursos.curso', 'titulo');

    res.json(compraActualizada);
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

// ========================================
// 👤 CRM - PERFIL DETALLADO DE USUARIO
// ========================================

// Obtener perfil completo de un usuario (con compras)
router.get('/usuario/:id/perfil', auth, esAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id)
      .select('-password')
      .populate('cursosComprados.curso', 'titulo imagen categoria nivel')
      .populate('productosComprados.producto', 'titulo imagen tipo');

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener historial de compras
    const compras = await Compra.find({ usuario: req.params.id })
      .populate('cursos.curso', 'titulo')
      .sort({ createdAt: -1 });

    // Calcular total gastado (solo compras aprobadas)
    const totalGastado = compras
      .filter(c => c.estadoPago === 'aprobado')
      .reduce((sum, c) => sum + (c.total || 0), 0);

    res.json({
      usuario,
      compras,
      totalGastado
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar notas del usuario
router.patch('/usuario/:id/notas', auth, esAdmin, async (req, res) => {
  try {
    const { notas } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { notas },
      { new: true }
    ).select('-password');

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar etiquetas del usuario
router.patch('/usuario/:id/etiquetas', auth, esAdmin, async (req, res) => {
  try {
    const { etiquetas } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { etiquetas },
      { new: true }
    ).select('-password');

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 🔔 NOTIFICACIONES EN TIEMPO REAL
// ========================================

// Obtener contador de notificaciones
router.get('/notificaciones/contador', auth, esAdmin, async (req, res) => {
  try {
    const pendientes = await Compra.countDocuments({
      estadoPago: { $in: ['pendiente', 'en_revision'] }
    });
    
    const ultimaCompra = await Compra.findOne({
      estadoPago: { $in: ['pendiente', 'en_revision'] }
    })
    .sort({ createdAt: -1 })
    .select('createdAt');
    
    res.json({
      contador: pendientes,
      ultimaActualizacion: ultimaCompra?.createdAt || null,
      hayNuevas: pendientes > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
