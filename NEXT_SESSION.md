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

## Estado actual (al cierre de esta sesión)

### Lo que ya está funcionando y commiteado
- ✅ Login JWT + auto-logout en 401 + sesión restaurada con `/api/auth/me`
- ✅ CRUD completo: tableros, columnas, casos, comentarios, campos personalizados, usuarios
- ✅ Middleware `requireAuth` protege rutas sensibles; rutas públicas para landing pages
- ✅ Contraseñas nunca retornadas en respuestas de API
- ✅ CORS con `credentials: true`, JSON body limit 10MB
- ✅ Contador atómico de casos con `ISOLATION LEVEL SERIALIZABLE`
- ✅ `GET /api/cards`: 4 queries batch (no N+1)
- ✅ `GET /api/users`: 2 queries batch (no N+1)
- ✅ `GET /api/boards`: 3 queries batch (no N+1)
- ✅ `GET /api/cards` filtra `deleted = false` (soft-delete correcto)
- ✅ 15 índices de rendimiento en PostgreSQL (board_id+deleted, sp_external_id, client_ref, etc.)
- ✅ Polling con Page Visibility API (pausa cuando el tab está oculto)
- ✅ Error Boundary global en `src/components/ErrorBoundary.tsx`
- ✅ Memory leak en DocumentViewer corregido (revoca objectURL anterior)
- ✅ Integración SFTP: sync PDFs, vinculación por `client_ref`, visor inline
- ✅ ZIP download de todos los archivos de un caso
- ✅ Formulario público por tablero (landing page sin login)
- ✅ Integración SAP B1 configurable por tablero
- ✅ Auto-importación desde SharePoint (SQL Server)
- ✅ Envío de email via Microsoft Graph

### Archivos clave a conocer
- `src/pages/Index.tsx` — controlador principal (~800 líneas de estado y handlers)
- `src/lib/api.ts` — cliente HTTP centralizado (todas las llamadas al backend)
- `backend/src/index.ts` — Express app; aquí se aplica `requireAuth` por ruta
- `backend/src/middleware/auth.ts` — middleware JWT
- `backend/src/routes/cards.routes.ts` — queries batch, SERIALIZABLE, soft-delete

## Tareas pendientes (ordenadas por impacto)

### Prioridad ALTA — Siguiente sesión
1. **React.memo en KanbanCard** (`src/components/Kanban.tsx`)
   - Actualmente cada drag-drop re-renderiza TODAS las tarjetas del tablero
   - Envolver el componente de tarjeta con `React.memo` + `useCallback` para handlers
   - Puede reducir renders en 80% en tableros con 100+ tarjetas

2. **Input validation en backend** (todas las rutas)
   - Actualmente no se validan UUIDs, campos requeridos, longitudes
   - Agregar validación con `zod` o validación manual en cada route handler
   - Priorizar: `POST /api/cards`, `POST /api/users`, `PUT /api/boards/:id`

3. **Loading state en CardDetail** (`src/components/CardDetail.tsx`)
   - Al guardar cambios no hay feedback visual de "guardando..."
   - Agregar `isSaving` state con spinner en el botón "Guardar"
   - Previene doble-submit en conexiones lentas

4. **Paginación en `/api/cards`**
   - Con 1 000 tx diarias, en 6 meses habrá ~180 000 casos en DB
   - Agregar `?page=1&limit=50` al GET de cards
   - Frontend: scroll infinito o paginación en el Kanban

### Prioridad MEDIA — Sesiones siguientes
5. **Retry logic en api.ts** con backoff exponencial
   - En `request()`, si el fetch falla por red (no 4xx/5xx), reintentar hasta 3 veces
   - Usar: `await new Promise(r => setTimeout(r, 500 * attempt))`

6. **Health check endpoint** `GET /api/health`
   - Hace ping a la DB (`SELECT 1`) y responde `{ ok: true, db: "connected", uptime: N }`
   - Útil para monitoreo y alertas

7. **SAP calls via backend proxy**
   - Actualmente las llamadas a SAP B1 van directo desde el frontend
   - Moverlas a `backend/src/routes/sap.routes.ts` para no exponer credenciales SAP al browser

8. **Logs estructurados** (pino o winston)
   - Reemplazar `console.error` por logger con niveles (no exponer stack traces al cliente en producción)
   - No devolver `detail: err.message` al cliente en producción

### Prioridad BAJA
9. Virtualización de lista larga de tarjetas (`react-virtual` o `@tanstack/react-virtual`)
10. Debounce en drag-drop (evitar guardar posición en cada frame)
11. Botón "Disparar sync SFTP" en la UI (actualmente solo via API)
12. Dashboard de métricas: casos abiertos/cerrados por día, tiempo promedio de resolución

## Comandos para arrancar

```sh
# Terminal 1 — Backend
cd "C:/Proyectos/Nuevo Jira/drag-flow-forge/backend"
npm run dev

# Terminal 2 — Frontend
cd "C:/Proyectos/Nuevo Jira/drag-flow-forge"
npm run dev
```

## Verificación rápida del estado
```sh
# Backend OK
curl http://localhost:3001/

# Login OK (sin campo "password" en respuesta)
curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq '{token: .token, user: .username}'

# Ruta protegida rechaza sin token
curl -s http://localhost:3001/api/users | jq .error
# → "Token requerido."
```
