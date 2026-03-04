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
/**
 * ────────────────────────────────────────────────────────────────────────────
 * FUNCIONES POSTGRESQL REQUERIDAS
 * Ejecutar en la DB antes de usar los reportes:
 *
 * psql -d allers -f backend/src/db/reports-functions.sql
 * ────────────────────────────────────────────────────────────────────────────
 */
export const REPORTS: ReportDefinition[] = [
  {
    id: 'casos_por_tablero',
    name: 'Casos por Tablero y Carril',
    description: 'Distribución actual de casos activos agrupados por tablero y carril. Útil para ver la carga de trabajo.',
    spName: 'rpt_casos_por_tablero',
    params: [
      { name: 'p_start', label: 'Desde (creación)', type: 'date', placeholder: 'Dejar vacío para todos' },
      { name: 'p_end',   label: 'Hasta (creación)', type: 'date', placeholder: 'Dejar vacío para todos' },
    ],
  },
  {
    id: 'tiempo_resolucion',
    name: 'Tiempo Promedio de Resolución',
    description: 'Horas promedio que tarda en cerrarse un caso, agrupado por tablero. Solo cuenta casos cerrados.',
    spName: 'rpt_tiempo_resolucion',
    params: [
      { name: 'p_start', label: 'Desde (cierre)', type: 'date', placeholder: 'Dejar vacío para todos' },
      { name: 'p_end',   label: 'Hasta (cierre)', type: 'date', placeholder: 'Dejar vacío para todos' },
    ],
  },
  {
    id: 'casos_por_dia',
    name: 'Casos Creados por Día',
    description: 'Evolución diaria de casos creados en el período. Útil para detectar picos de demanda.',
    spName: 'rpt_casos_por_dia',
    params: [
      {
        name: 'p_start',
        label: 'Desde',
        type: 'date',
        required: true,
        default: (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d.toISOString().split('T')[0];
        })(),
      },
      {
        name: 'p_end',
        label: 'Hasta',
        type: 'date',
        required: true,
        default: new Date().toISOString().split('T')[0],
      },
    ],
  },
  {
    id: 'productividad_usuario',
    name: 'Productividad por Usuario',
    description: 'Casos asignados, cerrados y comentarios por usuario activo en el período seleccionado.',
    spName: 'rpt_productividad_usuario',
    params: [
      { name: 'p_start', label: 'Desde', type: 'date', placeholder: 'Dejar vacío para todos' },
      { name: 'p_end',   label: 'Hasta', type: 'date', placeholder: 'Dejar vacío para todos' },
    ],
  },
];
