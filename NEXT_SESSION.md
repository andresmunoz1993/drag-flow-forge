# Prompt para la próxima sesión de desarrollo

## Contexto del proyecto
Allers es un sistema interno de gestión de casos Kanban para una empresa.
Objetivo operativo: **50 usuarios concurrentes, 1 000 transacciones diarias**.

## Stack completo
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui, puerto 8080
- **Backend**: Express + TypeScript (ts-node-dev), puerto 3001
- **DB**: PostgreSQL, base `allers`, usuario `postgres`, contraseña `allers123`
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

### Infraestructura y seguridad
- ✅ Login JWT + auto-logout en 401 + sesión restaurada con `/api/auth/me`
- ✅ Middleware `requireAuth` protege rutas sensibles
- ✅ Rutas públicas para landing pages (boards GET, cards GET/POST, sap POST)
- ✅ Contraseñas nunca retornadas en respuestas de API
- ✅ SAP password oculto en GET; preservado en PUT cuando se envía string vacío
- ✅ CORS con `credentials: true`, JSON body limit 10MB
- ✅ Proxy Vite `/api → localhost:3001` — sin CORS en desarrollo
- ✅ Retry logic en api.ts: 3 intentos con backoff 500ms×n

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
- ✅ Memory leak en DocumentViewer corregido
- ✅ Health check `GET /api/health` con ping a DB
- ✅ Botón "Sync SFTP" en header (solo admin), feedback de resultado

### Validación de inputs y logs (backend)
- ✅ `isUUID()` en todas las rutas: cards PUT, boards PUT, comments POST/PUT
- ✅ Validación de title, text, name, prefix con límites de caracteres
- ✅ `detail: err.message` oculto en producción (`NODE_ENV !== 'production'`)

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
- ✅ `backend/src/config/reports.config.ts` — definiciones de reportes, apuntan a funciones PostgreSQL
- ✅ `GET /api/reports` — lista metadatos; `POST /api/reports/:id/run` — ejecuta la función y devuelve filas
- ✅ `Reports.tsx`: grid de reportes → modal de filtros → tabla de resultados paginada + "Exportar CSV"
- ✅ Enlace "Reportes" en sidebar, visible para todos los usuarios logueados

---

## Tareas pendientes (ordenadas por impacto)

### Prioridad ALTA
1. **Agregar reportes reales a `reports.config.ts`**
   - Crear funciones en PostgreSQL (`CREATE OR REPLACE FUNCTION rpt_xxx(...)`)
   - Agregar las entradas en `backend/src/config/reports.config.ts`
   - Ejemplo de función: `SELECT * FROM rpt_casos_por_mes(p_start DATE, p_end DATE)`

### Prioridad MEDIA
2. **Dashboard de métricas**
   - Casos por estado (abierto/cerrado) por tablero
   - Tiempo promedio de resolución (closedAt - createdAt)
   - Casos creados por día (últimos 30 días)
   - Agregar gráficos simples con `recharts` (ya instalado)

### Prioridad BAJA
3. **Virtualización en Kanban** (`@tanstack/react-virtual`)
   - Para tableros con >500 tarjetas activas
   - Actualmente el renderizado es completo por columna

---

## Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `src/pages/Index.tsx` | Controlador principal (~840 líneas) |
| `src/lib/api.ts` | Cliente HTTP centralizado (proxy Vite, retry, JWT) |
| `src/components/Kanban.tsx` | Tablero + KanbanCard memoizado |
| `src/components/CaseList.tsx` | Lista paginada + filtros + export CSV |
| `src/components/CardDetail.tsx` | Detalle de caso (loading, confirmación responsable, menciones) |
| `src/components/MentionTextarea.tsx` | Textarea @autocomplete + renderWithMentions |
| `src/components/Reports.tsx` | Sección de reportes completa |
| `backend/src/index.ts` | Express app + routes + health check |
| `backend/src/middleware/auth.ts` | Middleware JWT: `requireAuth` |
| `backend/src/routes/cards.routes.ts` | Queries batch, SERIALIZABLE, notificaciones email |
| `backend/src/routes/users.routes.ts` | CRUD usuarios + emails de bienvenida/contraseña |
| `backend/src/routes/reports.routes.ts` | GET lista + POST run SP |
| `backend/src/config/reports.config.ts` | Definiciones de reportes (editar para agregar) |
| `backend/src/routes/sp.routes.ts` | Integración SharePoint |

## Verificación rápida
```sh
curl http://localhost:3001/api/health
# → {"ok":true,"db":"connected","uptime":123}

curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq '{token:.token, user:.username}'

curl -s http://localhost:3001/api/users | jq .error
# → "Token requerido."

# Listar reportes (con token)
curl -s http://localhost:3001/api/reports \
  -H "Authorization: Bearer <TOKEN>" | jq .
# → [] si aún no hay reportes configurados
```

## Migración pendiente (si no se ha corrido)
```sh
# Tabla card_mentions (ya debería estar)
cd "C:\Proyectos\Nuevo Jira\drag-flow-forge\backend"
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  CREATE TABLE IF NOT EXISTS card_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentioned_by_id TEXT NOT NULL DEFAULT '',
    mentioned_by_name TEXT NOT NULL DEFAULT '',
    first_mentioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context TEXT NOT NULL DEFAULT 'description',
    UNIQUE (card_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_card_mentions_card_id ON card_mentions(card_id);
\`).then(() => { console.log('OK'); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });
"
```
