/** Configuración SAP B1 almacenada en boards.sap_config (JSONB) */
export interface SapConfig {
  baseUrl:    string;
  companyDB:  string;
  username:   string;
  password:   string;
  queryName:  string;
}

/** Resultado de búsqueda de un documento SAP */
export interface SapOrderResult {
  docNum:          string;
  itemCount:       number;
  totalValue:      number;
  currency:        string;
  salesPersonCode: string;
  salesPersonName: string;
}
