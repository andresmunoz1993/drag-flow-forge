# Prompt para la próxima sesión de desarrollo

## Contexto del proyecto
Allers es un sistema interno de gestión de casos Kanban para una empresa.
Objetivo operativo: **50 usuarios concurrentes, 1 000 transacciones diarias**.

## Stack completo
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui, puerto 8080
- **Backend**: Express + TypeScript (ts-node-dev), puerto 3001
- **DB**: PostgreSQL, base `allers`, usuario `postgres`, contraseña `allers123` (cambiar en producción)
- **Auth**: JWT 7 días, token en localStorage como `auth_token`
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`)

## Comandos para arrancar

```sh
# Terminal 1 — Backend
cd "C:/Proyectos/Nuevo Jira/drag-flow-forge/backend"
npm run dev

# Terminal 2 — Frontend
cd "C:/Proyectos/Nuevo Jira/drag-flow-forge"
npm run dev
# Acceder en: http://localhost:8080
```

## Lo que ya está hecho (no tocar)

### Seguridad (implementado en sesión 2026-03-04)
- ✅ **JWT_SECRET obligatorio** — el servidor no arranca sin esta variable; sin fallback hardcoded
- ✅ **helmet** instalado y configurado (headers de seguridad HTTP)
- ✅ **express-rate-limit**: login máx 20/15min, API general máx 300/min
- ✅ **Validación spName en reports.routes.ts** — regex `[a-zA-Z_][a-zA-Z0-9_]*` al arrancar
- ✅ Login JWT + auto-logout en 401 + sesión restaurada con `/api/auth/me`
- ✅ Middleware `requireAuth` protege rutas sensibles
- ✅ Contraseñas nunca retornadas en respuestas de API
- ✅ SAP password oculto en GET; preservado en PUT cuando se envía string vacío
- ✅ CORS con `credentials: true`, JSON body limit 10MB
- ✅ Proxy Vite `/api → localhost:3001` — sin CORS en desarrollo
- ✅ Retry logic en api.ts: 3 intentos con backoff 500ms×n
- ✅ `detail: err.message` oculto en producción (`NODE_ENV !== 'production'`)
- ✅ `isUUID()` en todas las rutas: cards PUT, boards PUT, comments POST/PUT

### Infraestructura de producción (implementado en sesión 2026-03-04)
- ✅ **`ecosystem.config.js`** — PM2 con 2 instancias en modo cluster, auto-restart en 500MB
- ✅ **`migrate-all.ts`** — runner consolidado e idempotente de todas las migraciones
- ✅ **`backend/.env.example`** — plantilla con todas las variables documentadas
- ✅ **`.env.production`** — para VITE_BACKEND_URL en build de producción
- ✅ **`backend/src/db/reports-functions.sql`** — 4 funciones PostgreSQL listas para ejecutar
- ✅ Build backend: `tsc` → `dist/`; scripts `build` y `start` en backend/package.json

### Rendimiento
- ✅ Contador atómico con `ISOLATION LEVEL SERIALIZABLE`
- ✅ `GET /api/cards`: 4 queries batch, filtra `deleted = false`, params `limit`/`offset`
- ✅ `GET /api/users`: 2 queries batch (no N+1)
- ✅ `GET /api/boards`: 3 queries batch (no N+1)
- ✅ 15 índices de rendimiento en PostgreSQL
- ✅ Polling con Page Visibility API (pausa si el tab está oculto)
- ✅ KanbanCard memoizado con `React.memo` + `useCallback` + debounce drop 300ms
- ✅ Paginación en CaseList (50/página, búsqueda por código o título)

### UX y estabilidad
- ✅ ErrorBoundary global (`src/components/ErrorBoundary.tsx`)
- ✅ Loading state en CardDetail — spinner en "Guardar", bloquea doble-submit
- ✅ Health check `GET /api/health` con ping a DB + uptime
- ✅ Botón "Sync SFTP" en header (solo admin), feedback de resultado

### Módulos de integración
- ✅ SFTP Sync + DocumentViewer (PDFs vinculados por `client_ref`)
- ✅ ZIP download de todos los archivos de un caso
- ✅ Formulario público por tablero (landing page sin login)
- ✅ Integración SAP B1 configurable por tablero (proxy server-side)
- ✅ Auto-importación desde SharePoint (SQL Server)
- ✅ Envío de email via Microsoft Graph

### Notificaciones email (fire-and-forget)
- ✅ **Creación de usuario**: bienvenida con username + contraseña en texto plano
- ✅ **Cambio de contraseña**: aviso al usuario con nueva contraseña
- ✅ **Cambio de carril**: email al responsable del caso con "Antes → Ahora"
- ✅ **Cambio de responsable**: confirmación frontend + email al nuevo responsable
- ✅ **@Mención en descripción/comentario**: email al etiquetado (solo primera vez por caso)
- ✅ **Columna saturada >100 casos**: alerta a admins del tablero

### @Menciones
- ✅ Tabla `card_mentions` con `UNIQUE(card_id, user_id)` en PostgreSQL
- ✅ `MentionTextarea.tsx`: dropdown de autocomplete al escribir `@` en textarea
- ✅ `renderWithMentions(text, users)`: chips visuales en vistas de solo lectura
- ✅ Sección "Otros Colaboradores" en sidebar de CardDetail
- ✅ `GET /api/cards/:id/mentions` (protegido)

### Exportar CSV
- ✅ Botón "Exportar CSV" en CaseList descarga todos los casos filtrados actualmente
- ✅ BOM UTF-8, columnas: Código, Tablero, Título, Carril, Responsable, Informador, Creado, Estado

### Sección de Reportes
- ✅ `backend/src/config/reports.config.ts` — 4 reportes configurados (casos/tablero, tiempo resolución, por día, productividad)
- ✅ `backend/src/db/reports-functions.sql` — funciones PostgreSQL correspondientes (ejecutar en DB)
- ✅ `GET /api/reports` — lista metadatos; `POST /api/reports/:id/run` — ejecuta la función y devuelve filas
- ✅ `Reports.tsx`: grid de reportes → modal de filtros → tabla de resultados paginada + "Exportar CSV"

---

## Tareas pendientes para lanzamiento a producción

### CRÍTICO — Hacer en el servidor de producción (no en código)
1. **Rotar AZURE_CLIENT_SECRET** en Azure Portal → App Registrations → Certificates & secrets
2. **Cambiar contraseña de PostgreSQL** (`ALTER USER postgres PASSWORD 'nueva_contraseña'`)
3. **Crear usuario DB dedicado**: `CREATE USER allers_app WITH PASSWORD '...'; GRANT ALL ON DATABASE allers TO allers_app;`
4. **Configurar backups automáticos** con `pg_dump`:
   ```sh
   # crontab -e  (Linux) o Task Scheduler (Windows)
   0 2 * * * pg_dump -Fc allers > /backups/allers_$(date +%Y%m%d).dump
   ```

### ALTA — En servidor
5. **Instalar PM2** y arrancar con: `pm2 start ecosystem.config.js --env production`
6. **Configurar servidor web** (IIS o nginx) para:
   - Servir frontend desde `dist/`
   - Proxy `/api/*` → `localhost:3001`
   - HTTPS con certificado
7. **Configurar CORS_ORIGIN** en `backend/.env` con la URL exacta del frontend
8. **Ejecutar funciones SQL** de reportes: `psql -d allers -f backend/src/db/reports-functions.sql`
9. **Ejecutar migraciones**: `cd backend && npx ts-node src/db/migrate-all.ts`
10. **Monitoreo externo**: configurar ping a `/api/health` cada 5 min (UptimeRobot, etc.)

### MEDIA — Próximas sesiones de código
- Dashboard de métricas con gráficos `recharts` (casos por estado, tiempo resolución, tendencia diaria)
- Logging estructurado con `winston` (JSON en producción)
- Virtualización en Kanban con `@tanstack/react-virtual` (para tableros con >500 tarjetas)

---

## Proceso de deploy (resumen)

```sh
# 1. Build frontend
npm run build          # genera dist/ en raíz

# 2. Build backend
cd backend
npm run build          # genera backend/dist/

# 3. Arrancar con PM2 (en servidor)
cd ..
pm2 start ecosystem.config.js --env production
pm2 save               # persistir tras reinicio

# 4. Verificar
curl https://TU_DOMINIO/api/health
# → {"ok":true,"db":"connected","uptime":...}
```

---

## Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `src/pages/Index.tsx` | Controlador principal (~840 líneas) |
| `src/lib/api.ts` | Cliente HTTP centralizado (proxy Vite, retry, JWT, VITE_BACKEND_URL) |
| `src/components/Reports.tsx` | Sección de reportes completa |
| `backend/src/index.ts` | Express app + helmet + rate-limit + routes + health check |
| `backend/src/middleware/auth.ts` | Middleware JWT: `requireAuth` (sin fallback) |
| `backend/src/routes/cards.routes.ts` | Queries batch, SERIALIZABLE, notificaciones email |
| `backend/src/config/reports.config.ts` | Definiciones de reportes (4 configurados) |
| `backend/src/db/migrate-all.ts` | Runner consolidado de todas las migraciones |
| `backend/src/db/reports-functions.sql` | Funciones PostgreSQL de los 4 reportes |
| `backend/.env.example` | Plantilla de todas las variables de entorno |
| `ecosystem.config.js` | Configuración PM2 (2 instancias cluster) |

## Verificación rápida de desarrollo
```sh
curl http://localhost:3001/api/health
# → {"ok":true,"db":"connected","uptime":123}

curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq '{token:.token, user:.username}'

# Listar reportes configurados (con token)
curl -s http://localhost:3001/api/reports \
  -H "Authorization: Bearer <TOKEN>" | jq '.[].name'
# → "Casos por Tablero y Carril", "Tiempo Promedio de Resolución", etc.

# Rate limiting funcionando
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" -d '{"username":"x","password":"x"}';
done
# → primeros 20: 401, del 21 en adelante: 429
```
