// ========================================
// 🔧 BACKEND: RUTAS Y CONTROLADORES PARA PRODUCTOS
// Sistema completo de upload y descarga segura
// ========================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Producto = require('../models/Producto');
const Usuario = require('../models/Usuario');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ========================================
// CONFIGURACIÓN DE CLOUDINARY
// ========================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ========================================
// CONFIGURACIÓN DE MULTER (temporal)
// ========================================

const storage = multer.diskStorage({
  destination: '/tmp/uploads/',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024  // 500MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Permitir múltiples tipos de archivo
    const allowedTypes = [
      'application/pdf',
      'application/zip',
      'application/x-rar-compressed',
      'application/epub+zip',
      'application/vnd.adobe.photoshop',
      'application/postscript',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument',
      'image/vnd.adobe.photoshop',
      'application/x-msdownload',
      'application/x-apple-diskimage'
    ];
    
    if (allowedTypes.some(type => file.mimetype.includes(type))) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// ========================================
// 📤 SUBIR ARCHIVO A CLOUDINARY
// ========================================

const subirArchivo = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: 'raw',  // Importante para PDFs, ZIPs, etc.
      folder: 'productos-descargables',
      public_id: `archivo-${Date.now()}`,
      access_mode: 'authenticated'  // Requiere autenticación para acceder
    });
    
    return {
      url: result.secure_url,
      cloudinaryId: result.public_id,
      tamaño: (result.bytes / (1024 * 1024)).toFixed(2) + ' MB',
      tamañoBytes: result.bytes,
      formato: result.format
    };
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    throw new Error('Error al subir archivo');
  }
};

// ========================================
// 🆕 CREAR PRODUCTO (Admin)
// ========================================

router.post('/', authMiddleware, adminMiddleware, upload.array('archivos', 10), async (req, res) => {
  try {
    const datos = JSON.parse(req.body.datos);
    
    // Subir archivos a Cloudinary
    if (req.files && req.files.length > 0) {
      const archivosSubidos = await Promise.all(
        req.files.map(async (file, index) => {
          const resultado = await subirArchivo(file);
          return {
            nombre: datos.archivos[index]?.nombre || file.originalname,
            descripcion: datos.archivos[index]?.descripcion || '',
            url: resultado.url,
            cloudinaryId: resultado.cloudinaryId,
            tipo: file.mimetype.split('/')[1] || 'otro',
            tamaño: resultado.tamaño,
            tamañoBytes: resultado.tamañoBytes,
            extension: resultado.formato,
            orden: index + 1,
            esVistPrevia: datos.archivos[index]?.esVistPrevia || false
          };
        })
      );
      
      datos.archivos = archivosSubidos;
    }
    
    // Crear producto
    const producto = new Producto(datos);
    await producto.save();
    
    res.status(201).json({
      mensaje: 'Producto creado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// ========================================
// 📋 OBTENER TODOS LOS PRODUCTOS (público)
// ========================================

router.get('/', async (req, res) => {
  try {
    const { tipo, categoria, destacados, buscar, limite = 50 } = req.query;
    
    const filtros = { activo: true };
    
    if (tipo) filtros.tipo = tipo;
    if (categoria) filtros.categoria = categoria;
    if (destacados === 'true') filtros.destacado = true;
    if (buscar) {
      filtros.$or = [
        { titulo: { $regex: buscar, $options: 'i' } },
        { descripcion: { $regex: buscar, $options: 'i' } },
        { tags: { $in: [new RegExp(buscar, 'i')] } }
      ];
    }
    
    const productos = await Producto.find(filtros)
      .sort({ destacado: -1, createdAt: -1 })
      .limit(parseInt(limite))
      .select('-archivos.cloudinaryId');  // No exponer IDs internos
    
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// ========================================
// 🔍 OBTENER UN PRODUCTO (público)
// ========================================

router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    
    if (!producto || !producto.activo) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // No mostrar URLs de archivos si no está comprado
    const productoPublico = producto.toObject();
    
    // Si no es el usuario autenticado que lo compró, ocultar URLs reales
    if (!req.user || !verificarCompra(req.user.id, producto._id)) {
      productoPublico.archivos = producto.archivos.map(archivo => ({
        ...archivo,
        url: archivo.esVistPrevia ? archivo.url : null,  // Solo mostrar vistas previas
        cloudinaryId: undefined
      }));
    }
    
    res.json(productoPublico);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// ========================================
// 📥 DESCARGAR ARCHIVO (requiere compra)
// ========================================

router.get('/:productoId/descargar/:archivoId', authMiddleware, async (req, res) => {
  try {
    const { productoId, archivoId } = req.params;
    const userId = req.user.id;
    
    // Verificar que el producto existe
    const producto = await Producto.findById(productoId);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // Verificar que el usuario compró el producto
    const usuario = await Usuario.findById(userId);
    const compra = usuario.productosComprados?.find(
      p => p.producto.toString() === productoId && p.estadoPago === 'aprobado'
    );
    
    if (!compra) {
      return res.status(403).json({ 
        error: 'Debes comprar este producto para descargarlo' 
      });
    }
    
    // Verificar límites de descarga
    if (producto.limites?.descargasMaximas) {
      if (compra.descargas >= producto.limites.descargasMaximas) {
        return res.status(403).json({ 
          error: 'Has alcanzado el límite de descargas' 
        });
      }
    }
    
    // Verificar días de acceso
    if (producto.limites?.diasAcceso) {
      const diasDesdeCompra = Math.floor(
        (Date.now() - compra.fechaCompra) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeCompra > producto.limites.diasAcceso) {
        return res.status(403).json({ 
          error: 'Tu acceso ha expirado' 
        });
      }
    }
    
    // Encontrar el archivo
    const archivo = producto.archivos.find(a => a._id.toString() === archivoId);
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Generar URL temporal firmada (válida por 1 hora)
    const urlTemporal = cloudinary.url(archivo.cloudinaryId, {
      resource_type: 'raw',
      secure: true,
      sign_url: true,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 3600  // 1 hora
    });
    
    // Incrementar contador de descargas
    await Usuario.updateOne(
      { 
        _id: userId,
        'productosComprados.producto': productoId 
      },
      { 
        $inc: { 'productosComprados.$.descargas': 1 }
      }
    );
    
    await Producto.updateOne(
      { _id: productoId },
      { $inc: { descargas: 1 } }
    );
    
    res.json({ 
      downloadUrl: urlTemporal,
      nombre: archivo.nombre,
      expiraEn: '1 hora'
    });
  } catch (error) {
    console.error('Error generando descarga:', error);
    res.status(500).json({ error: 'Error al generar descarga' });
  }
});

// ========================================
// ✏️ ACTUALIZAR PRODUCTO (Admin)
// ========================================

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(producto);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// ========================================
// 🗑️ ELIMINAR PRODUCTO (Admin)
// ========================================

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    // Eliminar archivos de Cloudinary
    if (producto.archivos && producto.archivos.length > 0) {
      await Promise.all(
        producto.archivos.map(archivo => 
          cloudinary.uploader.destroy(archivo.cloudinaryId, { 
            resource_type: 'raw' 
          })
        )
      );
    }
    
    await producto.deleteOne();
    
    res.json({ mensaje: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// ========================================
// FUNCIÓN AUXILIAR: Verificar compra
// ========================================

const verificarCompra = async (userId, productoId) => {
  const usuario = await Usuario.findById(userId);
  return usuario.productosComprados?.some(
    p => p.producto.toString() === productoId && p.estadoPago === 'aprobado'
  );
};

module.exports = router;