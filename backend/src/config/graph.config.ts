import { ConfidentialClientApplication } from "@azure/msal-node";
import "isomorphic-fetch";

export const GRAPH_SCOPE = ["https://graph.microsoft.com/.default"];

// Lazy-initialized so the server can boot without .env (credentials are only
// required when an email is actually sent).
let _msalClient: ConfidentialClientApplication | null = null;

export function getMsalClient(): ConfidentialClientApplication {
  if (_msalClient) return _msalClient;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId) throw new Error("Missing AZURE_TENANT_ID");
  if (!clientId) throw new Error("Missing AZURE_CLIENT_ID");
  if (!clientSecret) throw new Error("Missing AZURE_CLIENT_SECRET");

  _msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  return _msalClient;
}
