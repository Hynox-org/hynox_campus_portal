import { BrevoClient } from "@getbrevo/brevo";

const apiKey = process.env.BREVO_API_KEY || "";
const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply-campus@hynox.in";
const senderName = process.env.BREVO_SENDER_NAME || "Hynox Campus";

const brevo = new BrevoClient({ apiKey, timeoutInSeconds: 20, maxRetries: 0 });

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));


export async function sendOnboardingEmail(
  toEmail: string,
  inviteLink: string,
  fullName: string,
  roleLabel: string,
  institutionName: string,
  idempotencyKey?: string
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
            <p class="welcome">Hello ${escapeHtml(fullName)},</p>
            <p class="text">
              You have been invited to join the <strong>${escapeHtml(institutionName)}</strong> campus tenant space on the Hynox Campus Portal. Below are your account details and your secure activation link.
            </p>
            
            <div class="details-card">
              <div class="detail-item">
                <span class="detail-label">Institution</span>
                <span class="detail-value">${escapeHtml(institutionName)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Assigned Role</span>
                <span class="detail-value">${escapeHtml(roleLabel)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Invited Email</span>
                <span class="detail-value">${escapeHtml(toEmail)}</span>
              </div>
            </div>

            <div class="btn-container">
              <a href="${escapeHtml(inviteLink)}" class="btn" target="_blank">Activate My Account</a>
            </div>

            <p class="text" style="margin-bottom: 0;">
              If the button doesn't work, copy and paste the link below into your web browser:
            </p>
            <div class="link-fallback">${escapeHtml(inviteLink)}</div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Hynox Campus. All rights reserved.</p>
            <p>If you did not expect this invitation, please ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: fullName }],
    subject: `[Hynox Campus] Onboarding Activation for ${institutionName}`,
    htmlContent: htmlContent,
    headers: idempotencyKey ? { idempotencyKey } : undefined,
  });
}

export async function sendPublicPurchaseEmail(
  toEmail: string,
  fullName: string,
  purchasedCourse: string,
  courses: string[],
  loginLink: string,
  duplicatePurchase: boolean,
  idempotencyKey: string
) {
  const courseList = courses.map(course => `<li style="margin:0 0 8px">${escapeHtml(course)}</li>`).join("");
  const duplicateNotice = duplicatePurchase
    ? `<div style="margin:0 0 24px;padding:16px;border:1px solid #F59E0B;border-radius:8px;background:#FFFBEB;color:#92400E">
        <strong>Duplicate purchase detected.</strong> You already have access to ${escapeHtml(purchasedCourse)}. Our team must verify and process the duplicate-payment refund. We will confirm separately when the refund has been completed.
      </div>`
    : `<p style="font-size:14px;line-height:24px;color:#475569">Your purchase of <strong>${escapeHtml(purchasedCourse)}</strong> is confirmed and access has been added to your existing Hynox Campus account.</p>`;
  const htmlContent = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#0F172A">
    <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
      <div style="padding:28px 32px;background:#0F172A;color:#fff"><strong>Hynox Campus Portal</strong></div>
      <div style="padding:32px"><p style="font-weight:600">Hello ${escapeHtml(fullName)},</p>${duplicateNotice}
        <p style="font-size:13px;font-weight:700;color:#475569;text-transform:uppercase">Courses available in your account</p>
        <ul style="padding-left:20px;font-size:14px;line-height:22px;color:#334155">${courseList}</ul>
        <p style="margin-top:28px;text-align:center"><a href="${escapeHtml(loginLink)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#2563EB;color:#fff;text-decoration:none;font-weight:600">Log in to Hynox Campus</a></p>
      </div>
      <div style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B">If you did not make this purchase, contact Hynox support.</div>
    </div></body></html>`;
  return brevo.transactionalEmails.sendTransacEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: fullName }],
    subject: duplicatePurchase
      ? `[Hynox Campus] Duplicate purchase detected: ${purchasedCourse}`
      : `[Hynox Campus] Purchase confirmed: ${purchasedCourse}`,
    htmlContent,
    headers: { idempotencyKey },
  });
}
