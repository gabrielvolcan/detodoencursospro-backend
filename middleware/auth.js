const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);

    if (!usuario || !usuario.activo) {
      throw new Error();
    }

    req.usuario = usuario;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Por favor autentícate' });
  }
};

const esAdmin = async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
    }
    next();
  } catch (error) {
    res.status(403).json({ error: 'Acceso denegado' });
  }
};

module.exports = { auth, esAdmin };
