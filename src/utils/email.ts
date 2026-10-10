import { BrevoClient } from "@getbrevo/brevo";

const apiKey = process.env.BREVO_API_KEY || "";
const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply-campus@hynox.in";
const senderName = process.env.BREVO_SENDER_NAME || "Hynox Campus";

const brevo = new BrevoClient({ apiKey });


export async function sendOnboardingEmail(
  toEmail: string,
  inviteLink: string,
  fullName: string,
  roleLabel: string,
  institutionName: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hynox Campus Activation</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #F8FAFC;
            color: #0F172A;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #0F172A;
            padding: 32px;
            text-align: center;
          }
          .header h1 {
            color: #FFFFFF;
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 32px;
          }
          .welcome {
            font-size: 16px;
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 8px;
            color: #0F172A;
          }
          .text {
            font-size: 14px;
            line-height: 24px;
            color: #475569;
            margin-bottom: 24px;
          }
          .details-card {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .detail-item {
            margin-bottom: 12px;
            font-size: 13px;
          }
          .detail-item:last-child {
            margin-bottom: 0;
          }
          .detail-label {
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.05em;
            display: block;
            margin-bottom: 2px;
          }
          .detail-value {
            font-weight: 600;
            color: #0F172A;
          }
          .btn-container {
            text-align: center;
            margin-bottom: 24px;
          }
          .btn {
            background-color: #2563EB;
            color: #FFFFFF !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            transition: background-color 0.2s ease;
          }
          .footer {
            background-color: #F8FAFC;
            padding: 24px 32px;
            border-top: 1px solid #E2E8F0;
            text-align: center;
            font-size: 12px;
            color: #64748B;
          }
          .footer p {
            margin: 0 0 8px 0;
          }
          .footer a {
            color: #2563EB;
            text-decoration: none;
            font-weight: 500;
          }
          .link-fallback {
            font-size: 11px;
            color: #64748B;
            word-break: break-all;
            background-color: #F8FAFC;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #E2E8F0;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hynox Campus Portal</h1>
          </div>
          <div class="content">
            <p class="welcome">Hello ${fullName},</p>
            <p class="text">
              You have been invited to join the <strong>${institutionName}</strong> campus tenant space on the Hynox Campus Portal. Below are your account details and your secure activation link.
            </p>
            
            <div class="details-card">
              <div class="detail-item">
                <span class="detail-label">Institution</span>
                <span class="detail-value">${institutionName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Assigned Role</span>
                <span class="detail-value">${roleLabel}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Invited Email</span>
                <span class="detail-value">${toEmail}</span>
              </div>
            </div>

            <div class="btn-container">
              <a href="${inviteLink}" class="btn" target="_blank">Activate My Account</a>
            </div>

            <p class="text" style="margin-bottom: 0;">
              If the button doesn't work, copy and paste the link below into your web browser:
            </p>
            <div class="link-fallback">${inviteLink}</div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Hynox Campus. All rights reserved.</p>
            <p>If you did not expect this invitation, please ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: fullName }],
    subject: `[Hynox Campus] Onboarding Activation for ${institutionName}`,
    htmlContent: htmlContent,
  });
}
