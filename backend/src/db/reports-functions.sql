-- ============================================================================
-- reports-functions.sql — Funciones PostgreSQL para los Reportes de Allers
-- ============================================================================
-- Ejecutar una sola vez en la DB de producción:
--   psql -d allers -f backend/src/db/reports-functions.sql
--
-- Es seguro re-ejecutar (CREATE OR REPLACE).
-- ============================================================================

-- ── 1. Casos por tablero y carril ────────────────────────────────────────────
-- Devuelve la distribución de casos activos agrupados por tablero y carril.
-- Parámetros opcionales: rango de fechas de creación de los casos.
CREATE OR REPLACE FUNCTION rpt_casos_por_tablero(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL
)
RETURNS TABLE(tablero TEXT, carril TEXT, total BIGINT) AS $$
  SELECT
    b.name  AS tablero,
    cl.name AS carril,
    COUNT(*) AS total
  FROM cards c
  JOIN boards  b  ON b.id  = c.board_id
  JOIN columns cl ON cl.id = c.column_id
  WHERE c.deleted = false
    AND (p_start IS NULL OR c.created_at::date >= p_start)
    AND (p_end   IS NULL OR c.created_at::date <= p_end)
  GROUP BY b.name, cl.name
  ORDER BY b.name, total DESC;
$$ LANGUAGE sql STABLE;


-- ── 2. Tiempo promedio de resolución ─────────────────────────────────────────
-- Calcula el tiempo promedio (en horas) entre creación y cierre de casos.
-- Solo incluye casos con closed=true y closed_at no nulo.
CREATE OR REPLACE FUNCTION rpt_tiempo_resolucion(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL
)
RETURNS TABLE(tablero TEXT, promedio_horas NUMERIC, total_cerrados BIGINT) AS $$
  SELECT
    b.name AS tablero,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (c.closed_at - c.created_at)) / 3600.0)::numeric,
      1
    ) AS promedio_horas,
    COUNT(*) AS total_cerrados
  FROM cards c
  JOIN boards b ON b.id = c.board_id
  WHERE c.closed = true
    AND c.closed_at IS NOT NULL
    AND c.deleted   = false
    AND (p_start IS NULL OR c.closed_at::date >= p_start)
    AND (p_end   IS NULL OR c.closed_at::date <= p_end)
  GROUP BY b.name
  ORDER BY promedio_horas;
$$ LANGUAGE sql STABLE;


-- ── 3. Casos creados por día ──────────────────────────────────────────────────
-- Evolución diaria del volumen de casos creados en el período.
CREATE OR REPLACE FUNCTION rpt_casos_por_dia(
  p_start DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(fecha DATE, total BIGINT) AS $$
  SELECT
    c.created_at::date AS fecha,
    COUNT(*) AS total
  FROM cards c
  WHERE c.deleted = false
    AND c.created_at::date BETWEEN p_start AND p_end
  GROUP BY c.created_at::date
  ORDER BY fecha;
$$ LANGUAGE sql STABLE;


-- ── 4. Productividad por usuario ──────────────────────────────────────────────
-- Muestra para cada usuario activo: casos asignados, cerrados y comentarios
-- realizados en el período. Útil para evaluación de equipo.
CREATE OR REPLACE FUNCTION rpt_productividad_usuario(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL
)
RETURNS TABLE(
  usuario     TEXT,
  asignados   BIGINT,
  cerrados    BIGINT,
  comentarios BIGINT
) AS $$
  SELECT
    u.full_name AS usuario,
    COUNT(DISTINCT c.id) FILTER (
      WHERE c.assignee_id = u.id
        AND (p_start IS NULL OR c.created_at::date >= p_start)
        AND (p_end   IS NULL OR c.created_at::date <= p_end)
    ) AS asignados,
    COUNT(DISTINCT c.id) FILTER (
      WHERE c.assignee_id = u.id
        AND c.closed = true
        AND (p_start IS NULL OR c.closed_at::date >= p_start)
        AND (p_end   IS NULL OR c.closed_at::date <= p_end)
    ) AS cerrados,
    (
      SELECT COUNT(*)
      FROM comments cm
      WHERE cm.user_id = u.id
        AND (p_start IS NULL OR cm.created_at::date >= p_start)
        AND (p_end   IS NULL OR cm.created_at::date <= p_end)
    ) AS comentarios
  FROM users u
  LEFT JOIN cards c ON c.assignee_id = u.id AND c.deleted = false
  WHERE u.active = true
  GROUP BY u.id, u.full_name
  ORDER BY cerrados DESC, asignados DESC;
$$ LANGUAGE sql STABLE;


-- ── Verificación ──────────────────────────────────────────────────────────────
-- Para verificar que las funciones se crearon correctamente:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_type = 'FUNCTION' AND routine_name LIKE 'rpt_%';
