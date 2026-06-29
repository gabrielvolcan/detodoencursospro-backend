// ========================================
// 💳 MÉTODOS DE PAGO MANUAL POR PAÍS (datos del receptor de pagos)
// Contiene datos personales/bancarios. Vive SOLO en el backend y se sirve
// vía GET /api/pagos-manual/metodos-pago/:pais (autenticado), de modo que
// NUNCA se incluyen en el bundle público del frontend.
// ========================================
const METODOS_PAGO_POR_PAIS = {
  internacional: {
    nombre: 'Internacional',
    metodos: [
      {
        tipo: 'paypal',
        nombre: 'PayPal',
        instrucciones: `Realiza tu pago por PayPal a:
gabrielalejandrovolcan@gmail.com
Concepto: Pago Curso + Tu Nombre
Luego sube la captura de tu pago como comprobante.
¿Dudas? Escríbenos a contacto@detodoencursos.com`
      }
    ]
  },
  peru: {
    nombre: 'Perú',
    metodos: [
      {
        tipo: 'bcp',
        nombre: 'BCP - Yape',
        instrucciones: `BCP 💵
GABRIEL VOLCAN
Cuenta: 37005887674096
CCI: 00237010588767409657
Yape: 989228665
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  chile: {
    nombre: 'Chile',
    metodos: [
      {
        tipo: 'falabella',
        nombre: 'Banco Falabella',
        instrucciones: `Yoryelis Manzaneda
RUT: 26.974.264-K
Email: manzanedayoryelis@gmail.com
Cuenta Corriente: 15170139561
Banco Falabella
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  argentina: {
    nombre: 'Argentina',
    metodos: [
      {
        tipo: 'mercadopago',
        nombre: 'Mercado Pago',
        instrucciones: `👤 Gabriel Volcan
¡Hola! 😀 Te comparto mis datos para que puedas enviarme pesos a través de Mercado Pago👇

Alias: gabriel.040.dejar.mp
CVU: 0000003100074314194223
Nombre: Gabriel Humberto Volcan Altuve`
      }
    ]
  },
  venezuela: {
    nombre: 'Venezuela',
    metodos: [
      {
        tipo: 'pagomovil',
        nombre: 'Pago Móvil - Banco de Venezuela',
        instrucciones: `Teléfono: 04129229098
Cédula: 25011281
Banco: 0102 Bco de Vzla
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  uruguay: {
    nombre: 'Uruguay',
    metodos: [
      {
        tipo: 'prex',
        nombre: 'Prex',
        instrucciones: `Gabriel Volcan
Cuenta Prex: 1771890
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  }
};

// Lista de países soportados (orden para el panel admin)
const PAISES = ['internacional', 'peru', 'chile', 'argentina', 'venezuela', 'uruguay'];

// Devuelve los métodos del país pedido (estático); cae a 'internacional' si no existe.
const obtenerMetodosPago = (codigoPais) => {
  const codigo = (codigoPais || 'internacional').toLowerCase();
  return METODOS_PAGO_POR_PAIS[codigo] || METODOS_PAGO_POR_PAIS.internacional;
};

// Versión que lee de la BD (editable desde el admin) con fallback al config.
const obtenerMetodosPagoDB = async (codigoPais) => {
  const codigo = (codigoPais || 'internacional').toLowerCase();
  try {
    const MetodoPago = require('../models/MetodoPago');
    const doc = await MetodoPago.findOne({ pais: codigo }).lean();
    if (doc && Array.isArray(doc.metodos) && doc.metodos.length) {
      return { nombre: doc.nombre || obtenerMetodosPago(codigo).nombre, metodos: doc.metodos };
    }
  } catch (e) {
    // Si falla la BD, usamos el config estático.
  }
  return obtenerMetodosPago(codigo);
};

// Todos los países para el panel admin: doc de BD si existe, si no el default del config.
const obtenerTodosMetodosAdmin = async () => {
  let docs = [];
  try {
    const MetodoPago = require('../models/MetodoPago');
    docs = await MetodoPago.find().lean();
  } catch (e) { docs = []; }
  const porPais = Object.fromEntries(docs.map((d) => [d.pais, d]));
  return PAISES.map((codigo) => {
    const def = METODOS_PAGO_POR_PAIS[codigo] || { nombre: codigo, metodos: [] };
    const db = porPais[codigo];
    return {
      pais: codigo,
      nombre: (db && db.nombre) || def.nombre,
      metodos: (db && Array.isArray(db.metodos) && db.metodos.length) ? db.metodos : def.metodos
    };
  });
};

module.exports = { METODOS_PAGO_POR_PAIS, PAISES, obtenerMetodosPago, obtenerMetodosPagoDB, obtenerTodosMetodosAdmin };
