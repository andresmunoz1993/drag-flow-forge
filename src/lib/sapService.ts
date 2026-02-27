import type { SapConfig, SapOrderResult } from '@/types';

export class SapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SapError';
  }
}

/**
 * Busca un documento (factura, remisión o pedido) en SAP Business One
 * mediante Service Layer ejecutando una xSQL query predefinida.
 *
 * Flujo:
 *  1. POST /b1s/v1/Login  → obtiene sesión (cookie)
 *  2. GET  /b1s/v1/SQLQueries('<queryName>')/List?$filter=DocNum eq '<num>'
 *  3. POST /b1s/v1/Logout
 *
 * El servidor SAP debe tener CORS habilitado para el origen de esta app
 * o bien accederse desde la misma red interna.
 *
 * Columnas esperadas de la xSQL query (nombre flexible, ver mapeo abajo):
 *   DocNum, ItemCount, TotalValue, DocCurrency, SalesPersonCode, SalesPersonName
 */
export const searchSapDocument = async (
  docNumber: string,
  config: SapConfig,
): Promise<SapOrderResult> => {
  const base = config.baseUrl.replace(/\/$/, '');

  // ── 1. Login ────────────────────────────────────────────────────────────
  let loginOk = false;
  try {
    const loginRes = await fetch(`${base}/b1s/v1/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        CompanyDB: config.companyDB,
        UserName: config.username,
        Password: config.password,
      }),
    });

    if (!loginRes.ok) {
      const body = await loginRes.json().catch(() => ({}));
      const msg = body?.error?.message?.value || `Error ${loginRes.status}`;
      throw new SapError(`No se pudo autenticar en SAP: ${msg}`);
    }
    loginOk = true;
  } catch (e) {
    if (e instanceof SapError) throw e;
    throw new SapError(
      'No se pudo conectar al servidor SAP. Verifique la URL y la red.',
    );
  }

  // ── 2. Consultar xSQL query ─────────────────────────────────────────────
  let result: SapOrderResult;
  try {
    const url =
      `${base}/b1s/v1/SQLQueries('${encodeURIComponent(config.queryName)}')/List` +
      `?$filter=DocNum eq '${encodeURIComponent(docNumber)}'`;

    const queryRes = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!queryRes.ok) {
      const body = await queryRes.json().catch(() => ({}));
      const msg = body?.error?.message?.value || `Error ${queryRes.status}`;
      throw new SapError(`Error al consultar SAP: ${msg}`);
    }

    const data = await queryRes.json();
    const rows: Record<string, unknown>[] = data?.value ?? [];

    if (rows.length === 0) {
      throw new SapError(
        `No se encontró el documento "${docNumber}" en SAP. Verifique el número e intente de nuevo.`,
      );
    }

    const row = rows[0];
    result = {
      docNum: String(row.DocNum ?? row.docnum ?? docNumber),
      itemCount: Number(row.ItemCount ?? row.LineCount ?? row.itemcount ?? 0),
      totalValue: Number(row.TotalValue ?? row.DocTotal ?? row.totalvalue ?? 0),
      currency: String(row.DocCurrency ?? row.Currency ?? row.currency ?? 'COP'),
      salesPersonCode: String(row.SalesPersonCode ?? row.SlpCode ?? row.salespersoncode ?? ''),
      salesPersonName: String(row.SalesPersonName ?? row.SlpName ?? row.salespersonname ?? ''),
    };
  } finally {
    // ── 3. Logout (best-effort) ─────────────────────────────────────────
    if (loginOk) {
      fetch(`${base}/b1s/v1/Logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    }
  }

  return result;
};
