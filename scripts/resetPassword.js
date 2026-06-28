// ========================================
// 🔑 RESET DE CONTRASEÑA (admin, uso local)
// Asigna una nueva contraseña a un usuario por email. El hashing y
// passwordChangedAt los maneja el pre('save') del modelo Usuario.
//
// Uso:
//   node scripts/resetPassword.js <email> <nuevaPassword>
// Ejemplo:
//   node scripts/resetPassword.js leazerpa@gmail.com "MiNuevaClave123"
// ========================================
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

async function main() {
  const [, , emailArg, nuevaPassword] = process.argv;

  if (!emailArg || !nuevaPassword) {
    console.error('❌ Uso: node scripts/resetPassword.js <email> <nuevaPassword>');
    process.exit(1);
  }
  if (nuevaPassword.length < 6) {
    console.error('❌ La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('❌ Falta MONGODB_URI en el .env');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  // Buscamos incluyendo el password (select:false) para poder reasignarlo
  const usuario = await Usuario.findOne({ email }).select('+password');
  if (!usuario) {
    console.error(`❌ No existe ningún usuario con el email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  usuario.password = nuevaPassword; // el pre('save') la hashea y setea passwordChangedAt
  // Aseguramos que la cuenta pueda iniciar sesión
  if (usuario.activo === false) usuario.activo = true;
  if (usuario.emailVerificado === false) usuario.emailVerificado = true;
  await usuario.save();

  console.log('✅ Contraseña actualizada correctamente para:', email);
  console.log('   Nombre:', usuario.nombre, '| Rol:', usuario.rol, '| Activo:', usuario.activo, '| Email verificado:', usuario.emailVerificado);
  console.log('ℹ️  Las sesiones anteriores quedaron invalidadas (passwordChangedAt). Inicia sesión con la nueva contraseña.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
