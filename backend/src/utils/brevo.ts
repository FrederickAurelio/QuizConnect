import dns from "node:dns";
import https from "node:https";
import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/** Prefer IPv4; many TLS failures to SaaS APIs are broken IPv6 paths. */
dns.setDefaultResultOrder("ipv4first");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || "";

if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY environment variable is not set.");
}
if (!SENDER_EMAIL) {
  throw new Error(
    "SENDER_EMAIL environment variable is not set. Please set it to your verified Brevo login email."
  );
}

const brevoHttpsAgent = new https.Agent({
  keepAlive: true,
  family: 4,
});

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

interface SendVerificationEmailOptions {
  email: string;
  verificationCode: string;
}

function isRetryableNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const code = err.code;
    if (
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED" ||
      code === "ENOTFOUND" ||
      code === "ENETUNREACH" ||
      code === "EAI_AGAIN"
    ) {
      return true;
    }
    const msg = err.message || "";
    return /TLS|socket|disconnected|secure connection/i.test(msg);
  }
  if (err instanceof Error) {
    return /TLS|socket|disconnected|secure connection|ECONNRESET|ETIMEDOUT/i.test(
      err.message
    );
  }
  return false;
}

async function postBrevoTransactionalEmail(body: Record<string, unknown>) {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.post(BREVO_SMTP_URL, body, {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        httpsAgent: brevoHttpsAgent,
        timeout: 60_000,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return res.data;
      }
      const detail =
        typeof res.data === "object" && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data);
      throw new Error(`Brevo HTTP ${res.status}: ${detail}`);
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableNetworkError(e)) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * Sends a transactional email containing a 6-digit verification code.
 */
export async function sendVerificationEmail({
  email,
  verificationCode,
}: SendVerificationEmailOptions): Promise<unknown> {
  const senderName = "QuizzConnect";

  const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hello,</p>
            <p>Your verification code for QuizzConnect is:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h2 style="color: #2E7D32; letter-spacing: 5px; margin: 0; font-size: 24px;">
                    <strong>${verificationCode}</strong>
                </h2>
            </div>
            <p>This code will expire in 5 minutes. Please enter it on the website to complete your verification.</p>
            <br>
            <p>Best regards,</p>
            <p><strong>${senderName} Team</strong></p>
        </div>
    `;

  const body = {
    sender: { email: SENDER_EMAIL, name: senderName },
    to: [{ email }],
    subject: "Your 6-Digit Verification Code",
    htmlContent,
  };

  try {
    console.log(`Sending verification code to: ${email} from ${SENDER_EMAIL}`);
    const data = await postBrevoTransactionalEmail(body);
    console.log("✅ Email sent successfully.");
    return data;
  } catch (error: unknown) {
    console.error("❌ Failed to send verification email:");
    if (error && typeof error === "object" && "response" in error) {
      const r = (error as AxiosError).response;
      console.error("Brevo response:", r?.status, r?.data);
    } else if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error(error);
    }
    throw new Error("Email sending failed. Please try again later.");
  }
}
