// ========================================
// 💰 FUENTE ÚNICA DE TASAS Y CÁLCULO DE PRECIOS (backend)
// Actualizadas 10 enero 2026. Debe coincidir con el frontend (PaisContext).
// Importado por models/Curso.js (pre-save) y routes/pagosManual.js.
// ========================================

// Tasas oficiales de conversión USD -> moneda local.
const TASAS = {
  peru: 3.36,
  chile: 894,
  argentina: 1505,
  uruguay: 38.9,
  venezuela: 50,
  internacional: 1
};

// Moneda por país.
const MONEDA_PAIS = {
  peru: 'PEN',
  chile: 'CLP',
  argentina: 'ARS',
  uruguay: 'UYU',
  venezuela: 'VES',
  internacional: 'USD'
};

// Países válidos para órdenes/precios.
const PAISES_VALIDOS = Object.keys(TASAS);

// Construye el objeto precios{pais} para un curso/producto a partir de su precioUSD.
// Mantiene el formato histórico: toFixed(2) para PEN/UYU/VES, Math.round para CLP/ARS, USD crudo.
const construirPreciosPorPais = (precioUSD) => ({
  peru: { monto: (precioUSD * TASAS.peru).toFixed(2), moneda: 'PEN' },
  chile: { monto: Math.round(precioUSD * TASAS.chile), moneda: 'CLP' },
  argentina: { monto: Math.round(precioUSD * TASAS.argentina), moneda: 'ARS' },
  uruguay: { monto: (precioUSD * TASAS.uruguay).toFixed(2), moneda: 'UYU' },
  venezuela: { monto: (precioUSD * TASAS.venezuela).toFixed(2), moneda: 'VES' },
  internacional: { monto: precioUSD, moneda: 'USD' }
});

// Precio de un ítem (curso o producto) según el país elegido.
// Usa precios[pais] ya configurados; si no, convierte precioUSD con la tasa oficial.
// Devuelve { precio, moneda } o null si el ítem no tiene precio configurado.
const precioItemPorPais = (item, pais) => {
  const paisNorm = (pais || 'internacional').toLowerCase();

  if (item.precios && item.precios[paisNorm] && item.precios[paisNorm].monto != null) {
    return {
      precio: Number(item.precios[paisNorm].monto),
      moneda: item.precios[paisNorm].moneda || MONEDA_PAIS[paisNorm]
    };
  }

  if (item.precioUSD != null && !isNaN(item.precioUSD)) {
    const tasa = TASAS[paisNorm] || 1;
    return {
      precio: Math.round(Number(item.precioUSD) * tasa * 100) / 100,
      moneda: MONEDA_PAIS[paisNorm] || 'USD'
    };
  }

  return null;
};

module.exports = {
  TASAS,
  MONEDA_PAIS,
  PAISES_VALIDOS,
  construirPreciosPorPais,
  precioItemPorPais
};
