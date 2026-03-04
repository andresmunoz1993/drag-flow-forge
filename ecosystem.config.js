/**
 * ecosystem.config.js — Configuración PM2 para producción.
 *
 * USO:
 *   # Primera vez:
 *   pm2 start ecosystem.config.js --env production
 *
 *   # Reiniciar tras deploy:
 *   pm2 reload allers-backend
 *
 *   # Ver logs:
 *   pm2 logs allers-backend
 *
 *   # Monitoreo en tiempo real:
 *   pm2 monit
 *
 *   # Iniciar PM2 con el sistema (Windows Task Scheduler o Linux systemd):
 *   pm2 startup && pm2 save
 *
 * PREREQUISITOS:
 *   1. npm install -g pm2
 *   2. cd backend && npm run build  (genera dist/)
 *   3. Configurar backend/.env con todos los valores de producción
 */
module.exports = {
  apps: [
    {
      name: 'allers-backend',
      script: './backend/dist/index.js',

      // Modo cluster: 2 instancias para manejar 50 usuarios concurrentes
      // Ajustar a 'max' si se necesita escalar horizontalmente
      instances: 2,
      exec_mode: 'cluster',

      // Reiniciar automáticamente si la memoria supera 500MB
      max_memory_restart: '500M',

      // Reiniciar exponencial con máximo de 5 intentos
      max_restarts: 5,
      min_uptime: '10s',

      // Ruta a los logs (crear el directorio si no existe: mkdir -p logs)
      error_file: './logs/allers-err.log',
      out_file:   './logs/allers-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Variables de entorno de desarrollo (npm start sin --env)
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },

      // Variables de entorno de producción (pm2 start ... --env production)
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // Las demás variables sensibles (JWT_SECRET, DATABASE_URL, etc.)
        // deben estar en el archivo backend/.env — NO ponerlas aquí.
      },
    },
  ],
};
