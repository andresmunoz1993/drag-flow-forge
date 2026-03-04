import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth";
import { pool } from "./db/index";

// Rutas existentes
import emailRouter from "./routes/email.routes";
import spRouter from "./routes/sp.routes";

// Nuevas rutas PostgreSQL
import authRouter          from "./routes/auth.routes";
import usersRouter         from "./routes/users.routes";
import boardsRouter        from "./routes/boards.routes";
import cardsRouter         from "./routes/cards.routes";
import commentsRouter      from "./routes/comments.routes";
import customFieldsRouter  from "./routes/custom-fields.routes";
import counterRouter       from "./routes/counter.routes";
import documentosRouter    from "./routes/documentos.routes";
import sapProxyRouter      from "./routes/sap-proxy.routes";
import reportsRouter       from "./routes/reports.routes";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));

// ── Rutas públicas ────────────────────────────────────────────────────────────
app.use("/api/auth",   authRouter);      // login y /me tienen su propia lógica JWT
app.use("/api/boards", boardsRouter);    // GET público para landing pages
app.use("/api/cards",  cardsRouter);     // GET/POST público para landing pages
app.use("/api/sap",    sapProxyRouter);  // Proxy SAP B1 (público — usado desde landing pages sin JWT)

// ── Rutas protegidas (requieren JWT) ──────────────────────────────────────────
app.use("/api/users",         requireAuth, usersRouter);
app.use("/api/cards/:cardId/comments", requireAuth, commentsRouter);
app.use("/api/comments",      requireAuth, commentsRouter);
app.use("/api/custom-fields", requireAuth, customFieldsRouter);
app.use("/api/counter",       requireAuth, counterRouter);
app.use("/api/documentos",    requireAuth, documentosRouter);

// ── Rutas existentes (email, SharePoint) ─────────────────────────────────────
app.use("/api/email",   requireAuth, emailRouter);
app.use("/api/sp",      requireAuth, spRouter);
app.use("/api/reports", requireAuth, reportsRouter);

// Root info
app.get("/", (_req, res) => {
  res.json({ service: "drag-flow-forge backend", status: "running" });
});

// Health check con ping a DB — útil para monitoreo y alertas
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected", uptime: Math.floor(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, db: "error" });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[DB]     DATABASE_URL: ${process.env.DATABASE_URL ? "✅ set" : "⚠ not set"}`);
  console.log(`[Email]  Sender: ${process.env.MAIL_SENDER ?? "⚠ not set"}`);
  console.log(`[SP]     DB Server: ${process.env.SP_DB_SERVER ?? "⚠ not set (modo stub)"}`);
  console.log(`[SFTP]   Host: ${process.env.SFTP_HOST ?? "⚠ not set"}`);
});
