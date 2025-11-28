import { SendSmtpEmail, TransactionalEmailsApi } from "@getbrevo/brevo";
import 'dotenv/config'

// --- TYPE DEFINITIONS ---
// Define an interface for the parameters needed by our custom send function
interface SendVerificationEmailOptions {
  email: string;
  verificationCode: string;
}

// --- API INITIALIZATION ---
// 1. Get API Key and Sender Email from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const SENDER_EMAIL = process.env.SENDER_EMAIL || "frederick.ah88@gmail.com"; // Add this variable

if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY environment variable is not set.");
}
if (!SENDER_EMAIL) {
  throw new Error(
    "SENDER_EMAIL environment variable is not set. Please set it to your verified Brevo login email."
  );
}

// 2. Create the API instance for Transactional Emails
const apiInstance = new TransactionalEmailsApi();

// 3. Configure the API key directly
(apiInstance as any).authentications["apiKey"].apiKey = BREVO_API_KEY;

/**
 * Sends a transactional email containing a 6-digit verification code.
 */
export async function sendVerificationEmail({
  email,
  verificationCode,
}: SendVerificationEmailOptions): Promise<any> {
  // Construct the email payload
  const sendSmtpEmail = new SendSmtpEmail();

  // USE THE VERIFIED SENDER FROM ENV
  const senderName = "QuizzConnect";

  sendSmtpEmail.to = [{ email: email }];
  sendSmtpEmail.subject = "Your 6-Digit Verification Code";
  sendSmtpEmail.sender = { email: SENDER_EMAIL, name: senderName };

  // HTML content for the verification code
  sendSmtpEmail.htmlContent = `
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

  try {
    console.log(`Sending verification code to: ${email} from ${SENDER_EMAIL}`);
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent successfully.");
    return data;
  } catch (error) {
    console.error("❌ Failed to send verification email:");
    throw new Error("Email sending failed. Please try again later.");
  }
}
