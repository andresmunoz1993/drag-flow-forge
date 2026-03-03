import { Client } from "@microsoft/microsoft-graph-client";
import { getMsalClient, GRAPH_SCOPE } from "../config/graph.config";

export interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // base64
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  bodyType?: "HTML" | "Text";
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

async function getAccessToken(): Promise<string> {
  const result = await getMsalClient().acquireTokenByClientCredential({
    scopes: GRAPH_SCOPE,
  });

  if (!result?.accessToken) {
    throw new Error("Failed to acquire access token from Azure AD");
  }

  return result.accessToken;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

function toRecipients(addresses: string | string[]) {
  const list = Array.isArray(addresses) ? addresses : [addresses];
  return list.map((addr) => ({
    emailAddress: { address: addr },
  }));
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const sender = process.env.MAIL_SENDER;
  if (!sender) throw new Error("Missing MAIL_SENDER in environment variables");

  const {
    to,
    subject,
    body,
    bodyType = "HTML",
    cc,
    bcc,
    attachments,
  } = options;

  const message: Record<string, unknown> = {
    subject,
    body: {
      contentType: bodyType,
      content: body,
    },
    toRecipients: toRecipients(to),
  };

  if (cc) message.ccRecipients = toRecipients(cc);
  if (bcc) message.bccRecipients = toRecipients(bcc);

  if (attachments && attachments.length > 0) {
    message.attachments = attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }));
  }

  const accessToken = await getAccessToken();
  const graphClient = getGraphClient(accessToken);

  // Send mail on behalf of MAIL_SENDER (requires Mail.Send application permission)
  await graphClient.api(`/users/${sender}/sendMail`).post({ message });
}
