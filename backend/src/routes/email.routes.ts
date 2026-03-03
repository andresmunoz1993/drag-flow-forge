import { Router, Request, Response } from "express";
import { sendEmail, SendEmailOptions } from "../services/email.service";

const router = Router();

/**
 * POST /api/email/send
 * Body: { to, subject, body, bodyType?, cc?, bcc?, attachments? }
 */
router.post("/send", async (req: Request, res: Response) => {
  const { to, subject, body, bodyType, cc, bcc, attachments } =
    req.body as SendEmailOptions;

  if (!to || !subject || !body) {
    res
      .status(400)
      .json({ error: "Fields 'to', 'subject' and 'body' are required." });
    return;
  }

  try {
    await sendEmail({ to, subject, body, bodyType, cc, bcc, attachments });
    res.status(200).json({ message: "Email sent successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[EmailRoute] Error sending email:", message);
    res.status(500).json({ error: "Failed to send email.", detail: message });
  }
});

/**
 * GET /api/email/health
 * Quick check that the route is reachable
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", sender: process.env.MAIL_SENDER ?? "not set" });
});

export default router;
