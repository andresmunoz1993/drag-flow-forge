# Allers — Sistema de Gestión

Sistema interno de gestión de casos tipo Kanban para equipos empresariales.
Soporta **50 usuarios concurrentes** y **1 000 transacciones diarias**.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Express + TypeScript (ts-node-dev), puerto **3001** |
| Base de datos | PostgreSQL (base `allers`) + Drizzle ORM |
| Auth | JWT (jsonwebtoken + bcryptjs) — token en `localStorage` |
| Email | Microsoft Graph API (Azure AD) |
| SharePoint | SQL Server directo (modo stub si no está configurado) |
| Documentos SFTP | ssh2-sftp-client — sync de PDFs desde servidor Windows |

---

## Prerequisitos

- Node.js ≥ 18 y npm
- PostgreSQL ≥ 14 corriendo localmente
- (Opcional) Servidor SFTP con PDFs para sync de documentos

---

## Instalación

### 1. Clonar y configurar

```sh
git clone <REPO_URL>
cd drag-flow-forge
```

### 2. Instalar dependencias

```sh
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```sh
cp backend/.env.example backend/.env
```

Variables mínimas requeridas en `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/allers
JWT_SECRET=cambia-esto-por-una-clave-segura

# Opcionales (el sistema funciona sin ellas en modo stub)
MAIL_SENDER=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
SP_DB_SERVER=
SFTP_HOST=
```

### 4. Crear la base de datos

```sh
# En psql o pgAdmin:
CREATE DATABASE allers;
```

### 5. Crear tablas e insertar usuario admin

```sh
cd backend
npx ts-node src/db/setup.ts
```

Esto crea todas las tablas y el usuario administrador por defecto:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

### 6. (Primera vez) Ejecutar migraciones adicionales

```sh
# Columna client_ref y tabla adjuntos_clientes (sync SFTP)
npx ts-node src/db/migrate-clientref.ts

# Índices de rendimiento
npx ts-node src/db/migrate-indexes.ts

cd ..
```

---

## Ejecución

Abrir **dos terminales** en la raíz del proyecto:

```sh
# Terminal 1 — Backend (puerto 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (puerto 8080)
npm run dev
```

La aplicación queda disponible en: **http://localhost:8080**

---

## Estructura del proyecto

```
drag-flow-forge/
├── src/                        # Frontend React
│   ├── components/             # Componentes UI reutilizables
│   │   ├── CardDetail.tsx      # Detalle completo de un caso
│   │   ├── Kanban.tsx          # Tablero Kanban con drag & drop
│   │   ├── DocumentViewer.tsx  # Visor de PDFs sincronizados por SFTP
│   │   ├── Login.tsx           # Pantalla de login JWT
│   │   └── ErrorBoundary.tsx   # Captura errores React globales
│   ├── pages/
│   │   ├── Index.tsx           # Controlador principal (estado global)
│   │   └── LandingPage.tsx     # Formulario público por tablero
│   ├── lib/
│   │   ├── api.ts              # Cliente HTTP centralizado (JWT)
│   │   └── storage.ts          # Utilidades: formatDate, generateId, etc.
│   └── types/index.ts          # Tipos TypeScript compartidos
│
└── backend/
    ├── src/
    │   ├── index.ts            # Express app + rutas
    │   ├── middleware/
    │   │   └── auth.ts         # Middleware JWT requireAuth
    │   ├── routes/             # Un archivo por recurso
    │   │   ├── auth.routes.ts
    │   │   ├── users.routes.ts
    │   │   ├── boards.routes.ts
    │   │   ├── cards.routes.ts
    │   │   ├── comments.routes.ts
    │   │   ├── custom-fields.routes.ts
    │   │   ├── counter.routes.ts
    │   │   ├── documentos.routes.ts
    │   │   ├── email.routes.ts
    │   │   └── sp.routes.ts
    │   ├── db/
    │   │   ├── schema.ts       # Esquema Drizzle ORM
    │   │   ├── index.ts        # Pool PostgreSQL + instancia Drizzle
    │   │   ├── setup.ts        # Crea tablas + admin inicial (1 vez)
    │   │   ├── migrate.ts      # Migraciones antiguas
    │   │   ├── migrate-clientref.ts  # client_ref + adjuntos_clientes
    │   │   └── migrate-indexes.ts    # Índices de rendimiento
    │   └── services/
    │       └── sftp-sync.service.ts  # Lógica de sync SFTP
    └── storage/
        └── pdfs/               # PDFs descargados por SFTP (local)
```

---

## Módulos implementados

### Kanban / Gestión de casos
- Tableros múltiples con columnas configurables
- Drag & drop de tarjetas entre columnas
- Campos personalizados por tablero (texto, número, fecha, select, fórmula)
- Comentarios con archivos adjuntos (hasta 10 MB por archivo)
- Descarga ZIP de todos los archivos de un caso
- Soft delete (casos eliminados no se muestran pero quedan en DB)

### Autenticación y roles
- Login JWT con sesión de 7 días
- Roles por tablero: `admin_tablero`, `ejecutor`, `consulta`
- `isAdminTotal`: acceso total a todos los tableros y configuración

### Formulario público (Landing)
- Cada tablero puede habilitar un formulario público sin login
- URL: `/landing/:boardId`

### Integración SAP B1
- Configurable por tablero (`board.sap`)
- Permite asociar casos a documentos SAP

### Auto-importación SharePoint (SP)
- Configurable por tablero (`board.spAutoImport`)
- Importa registros desde una vista de SQL Server

### Sync SFTP de documentos
- Descarga PDFs desde un servidor Windows vía SFTP
- Vincula archivos a casos mediante el campo **Ref. Cliente** (`client_ref`)
- Formato de nombre de archivo: `[COD_CLIENTE]_[TIPO].pdf` (ej: `CN13718_Cedula.pdf`)
- Los PDFs se visualizan inline dentro del detalle del caso
- Endpoint manual: `POST /api/documentos/sync`

---

## API — Endpoints principales

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, devuelve JWT |
| GET | `/api/auth/me` | JWT | Restaurar sesión |
| GET | `/api/boards` | — | Listar tableros (público para landing) |
| POST | `/api/boards` | JWT | Crear tablero |
| GET | `/api/cards?boardId=X` | — | Listar casos (excluye eliminados) |
| POST | `/api/cards` | — | Crear caso |
| PUT | `/api/cards/:id` | JWT | Actualizar caso |
| DELETE | `/api/cards/:id` | JWT | Soft-delete de caso |
| GET | `/api/users` | JWT | Listar usuarios |
| POST | `/api/documentos/sync` | JWT | Disparar sync SFTP manual |

> Las rutas marcadas como `—` son accesibles sin token para soportar el formulario público (landing page).

---

## Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

**Cambiar la contraseña en producción** usando la gestión de usuarios dentro de la app.

---

## Comandos útiles

```sh
# Verificar tipos TypeScript (frontend)
npm run build

# Verificar tipos TypeScript (backend)
cd backend && npx tsc --noEmit

# Verificar que el backend responde
curl http://localhost:3001/

# Login manual para obtener token
curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .token
```
