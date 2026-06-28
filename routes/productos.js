const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const Producto = require('../models/Producto');
const Usuario = require('../models/Usuario');
const { auth, esAdmin } = require('../middleware/auth');

// ========================================
// 📖 ALMACENAMIENTO DE LIBROS (GridFS) — para el lector en plataforma
// ========================================
// GridFS guarda archivos grandes (PDF/EPUB) en Mongo, troceados, de forma persistente.
function getLibrosBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'libros' });
}

const LIBRO_MIME = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub'
};

// multer en memoria; aceptamos PDF y EPUB hasta 50MB
const uploadLibro = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (LIBRO_MIME[file.mimetype] || ext === 'pdf' || ext === 'epub') {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos PDF o EPUB'));
  }
});

// Verifica si un usuario tiene acceso a un producto (lo compró aprobado, es gratis, o es admin)
function tieneAccesoProducto(usuario, producto) {
  if (usuario.rol === 'admin') return true;
  const esGratis = producto.gratis === true && (!producto.precioUSD || producto.precioUSD === 0);
  if (esGratis) return true;
  return (usuario.productosComprados || []).some(p => {
    const pid = typeof p.producto === 'object' && p.producto ? p.producto.toString() : String(p.producto);
    return pid === producto._id.toString() && p.estadoPago === 'aprobado';
  });
}

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
      subtitulo,
      descripcionLarga,
      tipo,
      categoria,
      imagen,
      imagenes,
      incluye,
      precioUSD,
      archivoURL,
      archivoPeso,
      gratis,
      destacado
    } = req.body;

    // Validación (archivoURL es opcional: puede ser un producto de solo lectura)
    if (!titulo || !descripcion || !tipo || !categoria) {
      return res.status(400).json({
        mensaje: 'Faltan campos obligatorios (titulo, descripcion, tipo, categoria)'
      });
    }

    const productoNuevo = new Producto({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      subtitulo: (subtitulo || '').trim(),
      descripcionLarga: (descripcionLarga || '').trim(),
      tipo,
      categoria: categoria.trim(),
      imagen: imagen?.trim() || 'https://via.placeholder.com/400x300?text=Producto',
      imagenes: Array.isArray(imagenes) ? imagenes.filter(Boolean) : [],
      incluye: Array.isArray(incluye) ? incluye.filter(Boolean) : [],
      precioUSD: gratis ? 0 : (parseFloat(precioUSD) || 0),
      archivoURL: (archivoURL || '').trim(),
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

// ========================================
// 📖 SUBIR LIBRO (Admin) — PDF/EPUB al lector en plataforma
// ========================================
router.post('/:id/libro', auth, esAdmin, uploadLibro.single('libro'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibió ningún archivo' });
    }
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    let formato = LIBRO_MIME[req.file.mimetype] || null;
    if (!formato && (ext === 'pdf' || ext === 'epub')) formato = ext;
    if (!formato) {
      return res.status(400).json({ mensaje: 'Formato no válido (solo PDF o EPUB)' });
    }

    const bucket = getLibrosBucket();

    // Borrar el libro anterior si existía
    if (producto.libro?.archivoId) {
      try { await bucket.delete(new mongoose.Types.ObjectId(producto.libro.archivoId)); } catch (e) { /* ignore */ }
    }

    // Guardar el nuevo archivo en GridFS
    const contentType = formato === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    const archivoId = await new Promise((resolve, reject) => {
      const up = bucket.openUploadStream(req.file.originalname, { contentType });
      up.on('error', reject);
      up.on('finish', () => resolve(up.id));
      up.end(req.file.buffer);
    });

    producto.libro = {
      archivoId,
      formato,
      nombreOriginal: req.file.originalname,
      soloLectura: req.body.soloLectura !== 'false'
    };
    await producto.save();

    res.json({
      mensaje: 'Libro subido correctamente',
      libro: { formato, nombreOriginal: req.file.originalname, soloLectura: producto.libro.soloLectura }
    });
  } catch (error) {
    console.error('Error subiendo libro:', error);
    res.status(500).json({ mensaje: 'Error al subir el libro' });
  }
});

// ========================================
// 📖 LEER LIBRO (protegido) — solo dueño / gratis / admin. Stremea desde GridFS.
// ========================================
router.get('/:id/leer', auth, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    if (!producto.libro?.archivoId) {
      return res.status(404).json({ mensaje: 'Este producto no tiene libro para leer' });
    }

    // Control de acceso: comprado (aprobado), gratis, o admin
    if (!tieneAccesoProducto(req.usuario, producto)) {
      return res.status(403).json({ mensaje: 'No tenés acceso a este libro' });
    }

    const bucket = getLibrosBucket();
    const fileId = new mongoose.Types.ObjectId(producto.libro.archivoId);

    const contentType = producto.libro.formato === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline'); // ver en el navegador, no descargar como adjunto
    res.set('Cache-Control', 'private, no-store');

    const stream = bucket.openDownloadStream(fileId);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ mensaje: 'Archivo no encontrado' });
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error sirviendo libro:', error);
    if (!res.headersSent) res.status(500).json({ mensaje: 'Error al abrir el libro' });
  }
});

// Metadatos del libro (formato) — para que el frontend sepa qué visor usar
router.get('/:id/libro-info', auth, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id).select('titulo libro gratis precioUSD');
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    if (!producto.libro?.archivoId) return res.status(404).json({ mensaje: 'Sin libro' });
    if (!tieneAccesoProducto(req.usuario, producto)) {
      return res.status(403).json({ mensaje: 'No tenés acceso a este libro' });
    }
    res.json({
      titulo: producto.titulo,
      formato: producto.libro.formato,
      nombreOriginal: producto.libro.nombreOriginal
    });
  } catch (error) {
    console.error('Error info libro:', error);
    res.status(500).json({ mensaje: 'Error' });
  }
});

module.exports = router;