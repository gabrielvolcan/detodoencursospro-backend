const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
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