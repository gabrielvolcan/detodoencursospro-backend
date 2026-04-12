const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
const Usuario = require('../models/Usuario');
const { auth, esAdmin } = require('../middleware/auth');

// ========================================
// 📋 OBTENER TODOS LOS PRODUCTOS (público)
// ========================================
router.get('/', async (req, res) => {
  try {
    const { tipo, categoria, destacados, gratis, buscar, limite = 50 } = req.query;
    
    const filtros = { activo: true };
    
    if (tipo) filtros.tipo = tipo;
    if (categoria) filtros.categoria = categoria;
    if (destacados === 'true') filtros.destacado = true;
    if (gratis === 'true') filtros.gratis = true;
    if (buscar) {
      filtros.$or = [
        { titulo: { $regex: buscar, $options: 'i' } },
        { descripcion: { $regex: buscar, $options: 'i' } },
        { tags: { $in: [new RegExp(buscar, 'i')] } }
      ];
    }
    
    const productos = await Producto.find(filtros)
      .sort({ destacado: -1, createdAt: -1 })
      .limit(parseInt(limite));
    
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ mensaje: 'Error al obtener productos' });
  }
});

// ========================================
// 📋 OBTENER TODOS (ADMIN - sin filtro activo)
// ========================================
router.get('/admin/todos', auth, esAdmin, async (req, res) => {
  try {
    const productos = await Producto.find()
      .sort({ createdAt: -1 });
    
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ mensaje: 'Error al obtener productos' });
  }
});

// ========================================
// 🔍 OBTENER UN PRODUCTO (público)
// ========================================
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    
    res.json(producto);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ mensaje: 'Error al obtener producto' });
  }
});

// ========================================
// 📥 DESCARGA GRATUITA (autenticado)
// ========================================
router.post('/:id/descarga-gratuita', auth, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar que el producto sea gratuito
    if (!producto.gratis && producto.precioUSD > 0) {
      return res.status(403).json({ error: 'Este producto no es gratuito' });
    }

    // Verificar que no lo tenga ya
    const usuario = await Usuario.findById(req.usuario._id);
    const yaLoTiene = usuario.productosComprados?.some(p => {
      const pid = typeof p.producto === 'object' ? p.producto.toString() : p.producto;
      return pid === req.params.id && p.estadoPago === 'aprobado';
    });

    if (!yaLoTiene) {
      if (!usuario.productosComprados) usuario.productosComprados = [];
      usuario.productosComprados.push({
        producto: producto._id,
        estadoPago: 'aprobado',
        fechaCompra: new Date(),
        precio: 0
      });
      await usuario.save();

      // Incrementar contador de descargas
      await Producto.findByIdAndUpdate(req.params.id, {
        $inc: { descargas: 1, totalCompradores: 1 }
      });
    }

    res.json({
      mensaje: 'Acceso concedido',
      archivoURL: producto.archivoURL
    });
  } catch (error) {
    console.error('Error en descarga gratuita:', error);
    res.status(500).json({ error: 'Error al procesar la descarga' });
  }
});

// ========================================
// 📥 DESCARGAR ARCHIVO (autenticado + comprado)
// ========================================
router.get('/:id/archivos/:archivoId/descargar', auth, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    // Verificar que el usuario lo compró
    const usuario = await Usuario.findById(req.usuario._id);
    const comprado = usuario.productosComprados?.some(p => {
      const pid = typeof p.producto === 'object' ? p.producto.toString() : p.producto;
      return pid === req.params.id && p.estadoPago === 'aprobado';
    });

    // También gratuito
    const esGratuito = producto.gratis || producto.precioUSD === 0;

    if (!comprado && !esGratuito) {
      return res.status(403).json({ error: 'No tienes acceso a este archivo' });
    }

    const archivo = producto.archivos?.find(
      a => a._id?.toString() === req.params.archivoId
    );

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Incrementar contador
    await Producto.findByIdAndUpdate(req.params.id, { $inc: { descargas: 1 } });

    res.json({ downloadUrl: archivo.url });
  } catch (error) {
    console.error('Error descargando archivo:', error);
    res.status(500).json({ error: 'Error al obtener el archivo' });
  }
});

// ========================================
// 🆕 CREAR PRODUCTO (Admin)
// ========================================
router.post('/', auth, esAdmin, async (req, res) => {
  try {
    const { 
      titulo, 
      descripcion, 
      tipo, 
      categoria, 
      imagen, 
      precioUSD, 
      archivoURL,
      archivoPeso,
      gratis,
      destacado
    } = req.body;
    
    // Validación
    if (!titulo || !descripcion || !tipo || !categoria || !archivoURL) {
      return res.status(400).json({ 
        mensaje: 'Faltan campos obligatorios (titulo, descripcion, tipo, categoria, archivoURL)'
      });
    }
    
    const productoNuevo = new Producto({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      tipo,
      categoria: categoria.trim(),
      imagen: imagen?.trim() || 'https://via.placeholder.com/400x300?text=Producto',
      precioUSD: gratis ? 0 : (parseFloat(precioUSD) || 0),
      archivoURL: archivoURL.trim(),
      archivoPeso: archivoPeso?.trim() || '',
      gratis: Boolean(gratis),
      destacado: Boolean(destacado),
      activo: true
    });
    
    await productoNuevo.save();
    
    res.status(201).json({
      mensaje: 'Producto creado exitosamente',
      producto: productoNuevo
    });
    
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ 
      mensaje: 'Error al crear producto',
      error: error.message
    });
  }
});

// ========================================
// ✏️ ACTUALIZAR PRODUCTO (Admin)
// ========================================
router.put('/:id', auth, esAdmin, async (req, res) => {
  try {
    const datosActualizados = { ...req.body };
    
    // Si se marca como gratis, precio = 0
    if (datosActualizados.gratis) {
      datosActualizados.precioUSD = 0;
    }
    
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      datosActualizados,
      { new: true, runValidators: true }
    );
    
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    
    res.json({
      mensaje: 'Producto actualizado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ 
      mensaje: 'Error al actualizar producto',
      error: error.message
    });
  }
});

// ========================================
// 🗑️ ELIMINAR PRODUCTO (Admin)
// ========================================
router.delete('/:id', auth, esAdmin, async (req, res) => {
  try {
    const producto = await Producto.findByIdAndDelete(req.params.id);
    
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    
    res.json({ mensaje: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ mensaje: 'Error al eliminar producto' });
  }
});

module.exports = router;