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
- ✅ Middleware `requireAuth` protege rutas sensibles (users, comments, docs, email, sp)
- ✅ Rutas públicas para landing pages (boards GET, cards GET/POST)
- ✅ Contraseñas nunca retornadas en respuestas de API
- ✅ CORS con `credentials: true`, JSON body limit 10MB
- ✅ Proxy Vite `/api → localhost:3001` — sin CORS en desarrollo
- ✅ Retry logic en api.ts: 3 intentos con backoff 500ms×n para errores de red

### Rendimiento
- ✅ Contador atómico con `ISOLATION LEVEL SERIALIZABLE`
- ✅ `GET /api/cards`: 4 queries batch, filtra `deleted = false`
- ✅ `GET /api/users`: 2 queries batch (no N+1)
- ✅ `GET /api/boards`: 3 queries batch (no N+1)
- ✅ 15 índices de rendimiento en PostgreSQL
- ✅ Polling con Page Visibility API (pausa si el tab está oculto)
- ✅ KanbanCard memoizado con `React.memo` + `useCallback` — evita re-render masivo al drag-drop

### UX y estabilidad
- ✅ ErrorBoundary global (`src/components/ErrorBoundary.tsx`)
- ✅ Loading state en CardDetail — spinner en "Guardar", bloquea doble-submit
- ✅ Memory leak en DocumentViewer corregido
- ✅ Health check `GET /api/health` con ping a DB

### Validación de inputs (backend)
- ✅ `POST /api/cards`: boardId, columnId, title validados
- ✅ `POST /api/users`: username (3-50), password (min 6), fullName validados

### Módulos de integración
- ✅ SFTP Sync + DocumentViewer (PDFs vinculados por `client_ref`)
- ✅ ZIP download de todos los archivos de un caso
- ✅ Formulario público por tablero (landing page sin login)
- ✅ Integración SAP B1 configurable por tablero
- ✅ Auto-importación desde SharePoint (SQL Server)
- ✅ Envío de email via Microsoft Graph

---

## Tareas pendientes (ordenadas por impacto)

### Prioridad ALTA — Siguiente sesión
1. **Paginación en `/api/cards`**
   - Con 1 000 tx diarias, en 6 meses habrá ~180 000 casos en DB
   - Agregar `?page=1&limit=50` al GET de cards
   - Frontend: virtual scroll o paginación por columna en el Kanban
   - Es el riesgo más grande de degradación a largo plazo

2. **Input validation completa** (rutas restantes)
   - Faltan: `PUT /api/cards/:id`, `PUT /api/boards/:id`, `POST /api/comments`
   - Validar que los IDs sean UUIDs válidos (`/^[0-9a-f-]{36}$/i`)
   - Validar longitudes de description, comment text

3. **SAP calls via backend proxy**
   - Actualmente las llamadas a SAP B1 van directo desde el frontend (expone credenciales)
   - Moverlas a `backend/src/routes/sap.routes.ts`

### Prioridad MEDIA
4. **Logs estructurados** — no exponer `detail: err.message` en producción
   - Simple: `...(process.env.NODE_ENV !== 'production' && { detail: err.message })`

5. **Botón "Sync SFTP" en la UI**
   - Actualmente solo se dispara via `POST /api/documentos/sync` directamente

6. **Debounce en drag-drop** (~300ms para no guardar en cada frame)

### Prioridad BAJA
7. Virtualización de lista larga (`@tanstack/react-virtual`)
8. Dashboard de métricas: casos por estado/día, tiempo promedio de resolución

---

## Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `src/pages/Index.tsx` | Controlador principal (~800 líneas) |
| `src/lib/api.ts` | Cliente HTTP centralizado (proxy Vite, retry, JWT) |
| `src/components/Kanban.tsx` | Tablero + KanbanCard memoizado |
| `src/components/CardDetail.tsx` | Detalle de caso (loading state incluido) |
| `backend/src/index.ts` | Express app + routes + health check |
| `backend/src/middleware/auth.ts` | Middleware JWT: `requireAuth` |
| `backend/src/routes/cards.routes.ts` | Queries batch, SERIALIZABLE, soft-delete, validación |

## Verificación rápida
```sh
curl http://localhost:3001/api/health
# → {"ok":true,"db":"connected","uptime":123}

curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq '{token:.token, user:.username}'

curl -s http://localhost:3001/api/users | jq .error
# → "Token requerido."
```
