/**
 * Seed: crea los datos iniciales en la base de datos.
 * Ejecutar una sola vez: npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { users, boards, columns, userBoardRoles, cards } from './schema.js';

async function seed() {
  console.log('🌱 Iniciando seed...');

  // --- Usuarios ---
  const hash = async (pw: string) => bcrypt.hash(pw, 10);

  const [admin] = await db.insert(users).values({
    username: 'admin',
    passwordHash: await hash('admin123'),
    fullName: 'Administrador General',
    email: 'admin@allers.com',
    isAdminTotal: true,
    active: true,
  }).onConflictDoNothing().returning();

  const [mgarcia] = await db.insert(users).values({
    username: 'mgarcia',
    passwordHash: await hash('maria123'),
    fullName: 'María García',
    email: 'mgarcia@allers.com',
    isAdminTotal: false,
    active: true,
  }).onConflictDoNothing().returning();

  const [plopez] = await db.insert(users).values({
    username: 'plopez',
    passwordHash: await hash('pedro123'),
    fullName: 'Pedro López',
    email: 'plopez@allers.com',
    isAdminTotal: false,
    active: true,
  }).onConflictDoNothing().returning();

  const [amoreno] = await db.insert(users).values({
    username: 'amoreno',
    passwordHash: await hash('ana123'),
    fullName: 'Ana Moreno',
    email: 'amoreno@allers.com',
    isAdminTotal: false,
    active: true,
  }).onConflictDoNothing().returning();

  console.log('✅ Usuarios creados');

  // --- Tableros ---
  const [inc] = await db.insert(boards).values({
    name: 'Incidencias Allers', prefix: 'AGDS', nextNum: 3900,
  }).onConflictDoNothing().returning();

  const [cc] = await db.insert(boards).values({
    name: 'Allers - Call Center', prefix: 'ACC', nextNum: 74200,
  }).onConflictDoNothing().returning();

  const [sac] = await db.insert(boards).values({
    name: 'Allers - Servicio al cliente', prefix: 'ASAC', nextNum: 78900,
  }).onConflictDoNothing().returning();

  console.log('✅ Tableros creados');

  // --- Columnas tablero Incidencias ---
  const incCols = await db.insert(columns).values([
    { boardId: inc.id, name: 'En Análisis',  order: 0 },
    { boardId: inc.id, name: 'Por hacer',    order: 1 },
    { boardId: inc.id, name: 'En Progreso',  order: 2 },
    { boardId: inc.id, name: 'Hecho',        order: 3 },
    { boardId: inc.id, name: 'Entregar',     order: 4 },
  ]).returning();

  // --- Columnas tablero Call Center ---
  await db.insert(columns).values([
    { boardId: cc.id, name: 'Call Center',            order: 0 },
    { boardId: cc.id, name: 'Servicio al cliente',    order: 1 },
    { boardId: cc.id, name: 'Almacén',                order: 2 },
    { boardId: cc.id, name: 'Logística',              order: 3 },
    { boardId: cc.id, name: 'Calidad',                order: 4 },
    { boardId: cc.id, name: 'Serv. Técnico',          order: 5 },
    { boardId: cc.id, name: 'Cartera',                order: 6 },
    { boardId: cc.id, name: 'Compras',                order: 7 },
    { boardId: cc.id, name: 'Comercial',              order: 8 },
    { boardId: cc.id, name: 'Cotizaciones',           order: 9 },
    { boardId: cc.id, name: 'Entregado para cierre',  order: 10 },
    { boardId: cc.id, name: 'Cerrada',                order: 11 },
    { boardId: cc.id, name: 'Entregar',               order: 12 },
  ]);

  // --- Columnas tablero SAC ---
  await db.insert(columns).values([
    { boardId: sac.id, name: 'Servicio al cliente',   order: 0 },
    { boardId: sac.id, name: 'Almacén',               order: 1 },
    { boardId: sac.id, name: 'Logística',             order: 2 },
    { boardId: sac.id, name: 'Calidad',               order: 3 },
    { boardId: sac.id, name: 'Tiendas',               order: 4 },
    { boardId: sac.id, name: 'Serv. Técnico',         order: 5 },
    { boardId: sac.id, name: 'Cartera',               order: 6 },
    { boardId: sac.id, name: 'Compras',               order: 7 },
    { boardId: sac.id, name: 'Comercial',             order: 8 },
    { boardId: sac.id, name: 'Cotizaciones',          order: 9 },
    { boardId: sac.id, name: 'Entregado para cierre', order: 10 },
    { boardId: sac.id, name: 'SEGUIMIENTO CALLCENTER',order: 11 },
    { boardId: sac.id, name: 'Cerrada',               order: 12 },
    { boardId: sac.id, name: 'Entregar',              order: 13 },
  ]);

  console.log('✅ Columnas creadas');

  // --- Roles de usuario por tablero ---
  if (mgarcia) {
    await db.insert(userBoardRoles).values([
      { userId: mgarcia.id, boardId: inc.id, role: 'admin_tablero' },
      { userId: mgarcia.id, boardId: cc.id,  role: 'ejecutor' },
    ]).onConflictDoNothing();
  }
  if (plopez) {
    await db.insert(userBoardRoles).values([
      { userId: plopez.id, boardId: cc.id,  role: 'ejecutor' },
      { userId: plopez.id, boardId: sac.id, role: 'ejecutor' },
    ]).onConflictDoNothing();
  }
  if (amoreno) {
    await db.insert(userBoardRoles).values([
      { userId: amoreno.id, boardId: inc.id, role: 'consulta' },
      { userId: amoreno.id, boardId: sac.id, role: 'consulta' },
    ]).onConflictDoNothing();
  }

  console.log('✅ Roles asignados');

  // --- Tarjetas de ejemplo ---
  if (mgarcia && amoreno && incCols.length >= 4) {
    await db.insert(cards).values([
      {
        boardId: inc.id, columnId: incCols[0].id,
        code: 'AGDS-3181',
        title: 'Documentación y accesos ambiente de pruebas LA PRENSA',
        description: 'Referente al punto 1.',
        priority: 'alta', type: 'Mejora',
        assigneeId: mgarcia.id, reporterId: amoreno.id, reporterName: 'Ana Moreno',
        createdAt: new Date('2022-03-28T12:09:00'),
        modifiedBy: 'María García', modifiedAt: new Date('2023-10-17T18:29:00'),
      },
      {
        boardId: inc.id, columnId: incCols[1].id,
        code: 'AGDS-3104',
        title: 'Error sale nombres de usuarios diferentes',
        description: '',
        priority: 'alta', type: 'Bug',
        assigneeId: mgarcia.id, reporterId: mgarcia.id, reporterName: 'María García',
        createdAt: new Date('2022-03-15T10:00:00'),
      },
      {
        boardId: inc.id, columnId: incCols[2].id,
        code: 'AGDS-3884',
        title: 'CAMPO AGENTE GRUPO SAC',
        description: '',
        priority: 'alta', type: 'Soporte',
        assigneeId: mgarcia.id, reporterId: amoreno.id, reporterName: 'Ana Moreno',
        createdAt: new Date('2023-06-15T08:00:00'),
      },
      {
        boardId: inc.id, columnId: incCols[3].id,
        code: 'AGDS-3756',
        title: 'Compra de diadema Nicolas Vivas',
        description: '',
        priority: 'media', type: 'Soporte',
        assigneeId: plopez?.id ?? mgarcia.id, reporterId: mgarcia.id, reporterName: 'María García',
        createdAt: new Date('2023-02-10T11:00:00'),
      },
    ]).onConflictDoNothing();
    console.log('✅ Tarjetas de ejemplo creadas');
  }

  console.log('\n🎉 Seed completado.');
  console.log('   Usuario admin: admin / admin123');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
