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
      // Escapar metacaracteres regex y limitar longitud (previene ReDoS)
      const termino = String(buscar).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filtros.$or = [
        { titulo: { $regex: termino, $options: 'i' } },
        { descripcion: { $regex: termino, $options: 'i' } },
        { tags: { $in: [new RegExp(termino, 'i')] } }
      ];
    }

    const productos = await Producto.find(filtros)
      .select('-archivoURL -archivos')
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
// 🔍 OBTENER UN PRODUCTO COMPLETO (Admin) — incluye archivoURL para editar
// ========================================
router.get('/admin/:id', auth, esAdmin, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json(producto);
  } catch (error) {
    console.error('Error obteniendo producto (admin):', error);
    res.status(500).json({ mensaje: 'Error al obtener producto' });
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

    // Endpoint PÚBLICO: no exponer los links reales de descarga.
    // Se conservan metadatos que la UI necesita (titulo, descripcion, tipo,
    // imagen, precios, nombres/cantidad de archivos) pero se elimina archivoURL
    // y la URL real dentro de cada archivo. La descarga real va por endpoint
    // autenticado. Se preserva la URL solo en items de vista previa (esVistaPrevia).
    const productoPublico = producto.toObject();
    delete productoPublico.archivoURL;

    if (Array.isArray(productoPublico.archivos)) {
      productoPublico.archivos = productoPublico.archivos.map((archivo) => {
        if (archivo && typeof archivo === 'object') {
          const copia = { ...archivo };
          if (!copia.esVistaPrevia) {
            delete copia.url;
            delete copia.archivoURL;
          }
          return copia;
        }
        return archivo;
      });
    }

    res.json(productoPublico);
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

    // Verificar que el producto sea REALMENTE gratuito.
    // Solo se entrega el archivo si gratis === true Y no tiene precio.
    const esRealmenteGratis = producto.gratis === true && (!producto.precioUSD || producto.precioUSD === 0);
    if (!esRealmenteGratis) {
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

    // También gratuito — SOLO si está marcado explícitamente como gratis.
    // No se usa `precioUSD === 0` porque el default del modelo es 0 y dejaría
    // descargables productos de pago sin precio configurado.
    const esGratuito = producto.gratis === true && (!producto.precioUSD || producto.precioUSD === 0);

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
// Campos editables permitidos (whitelist según el schema de Producto)
const CAMPOS_EDITABLES_PRODUCTO = [
  'titulo', 'subtitulo', 'descripcion', 'descripcionLarga', 'tipo', 'categoria',
  'imagen', 'imagenes', 'archivoURL', 'archivoPeso', 'archivos', 'precioUSD',
  'precios', 'activo', 'destacado', 'gratis', 'nuevo', 'tags', 'metadatos',
  'videos', 'incluye', 'oferta', 'limites', 'slug', 'valoracion'
];

router.put('/:id', auth, esAdmin, async (req, res) => {
  try {
    // Whitelist: solo se aceptan campos editables conocidos del modelo
    const datosActualizados = {};
    for (const campo of CAMPOS_EDITABLES_PRODUCTO) {
      if (req.body[campo] !== undefined) {
        datosActualizados[campo] = req.body[campo];
      }
    }

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