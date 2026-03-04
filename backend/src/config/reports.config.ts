/**
 * reports.config.ts — Definición de los reportes disponibles en la sección de Reportes.
 *
 * Cada reporte apunta a una función PostgreSQL que devuelve un conjunto de filas.
 * La función se llama como: SELECT * FROM sp_name($1, $2, ...)
 *
 * Para agregar un nuevo reporte:
 *   1. Crear la función en PostgreSQL (ej: CREATE OR REPLACE FUNCTION rpt_casos_por_mes(...))
 *   2. Agregar una entrada en el array REPORTS con el nombre y sus parámetros.
 */

export interface ReportParam {
  /** Posición en el array de parámetros (0-based, coincide con el orden en la firma de la función) */
  name:      string;        // Nombre interno del parámetro (para el cuerpo de la petición)
  label:     string;        // Etiqueta que verá el usuario
  type:      'date' | 'text' | 'number' | 'select';
  required?: boolean;       // Si es requerido (default: false)
  options?:  string[];      // Solo para type='select'
  default?:  string;        // Valor por defecto
  placeholder?: string;     // Hint en el input
}

export interface ReportDefinition {
  id:          string;      // Identificador único del reporte
  name:        string;      // Nombre visible
  description: string;      // Descripción breve
  spName:      string;      // Nombre de la función PostgreSQL a ejecutar
  params:      ReportParam[];
}

/**
 * Lista de reportes disponibles.
 * Cada entrada ejecuta SELECT * FROM spName($params...) en PostgreSQL.
 *
 * IMPORTANTE: El orden de los parámetros en `params` debe coincidir con
 * el orden de los argumentos de la función PostgreSQL.
 */
export const REPORTS: ReportDefinition[] = [
  // ── Ejemplo (descomentar y ajustar) ────────────────────────────────────────
  // {
  //   id: 'casos_por_mes',
  //   name: 'Casos Creados por Mes',
  //   description: 'Cantidad de casos creados agrupados por mes en el período seleccionado.',
  //   spName: 'rpt_casos_por_mes',
  //   params: [
  //     { name: 'p_start', label: 'Fecha inicio', type: 'date', required: true },
  //     { name: 'p_end',   label: 'Fecha fin',    type: 'date', required: true },
  //   ]
  // },
  // {
  //   id: 'tiempo_por_responsable',
  //   name: 'Tiempo de Atención por Responsable',
  //   description: 'Tiempo promedio de cierre de casos agrupado por responsable.',
  //   spName: 'rpt_tiempo_responsable',
  //   params: [
  //     { name: 'p_board_id', label: 'Tablero', type: 'text', placeholder: 'UUID del tablero' },
  //     { name: 'p_start',    label: 'Desde',   type: 'date', required: true },
  //     { name: 'p_end',      label: 'Hasta',   type: 'date', required: true },
  //   ]
  // },
];
