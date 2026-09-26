/**
 * Transactional email through Brevo's HTTP API
 * (https://developers.brevo.com/reference/sendtransacemail).
 *
 * Needs BREVO_API_KEY and MAIL_FROM_EMAIL (a sender verified in Brevo);
 * MAIL_FROM_NAME is optional. When Brevo isn't configured the message is
 * logged to the server console instead, so local development still works
 * and an admin can confirm accounts manually.
 */

export interface Mail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}

export function mailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && !!process.env.MAIL_FROM_EMAIL;
}

/** Returns true when the message was handed to Brevo, false when only logged. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    console.warn(`[mail] Brevo not configured - not sending "${mail.subject}" to ${mail.to}:\n${mail.text}`);
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM_EMAIL, name: process.env.MAIL_FROM_NAME || "HxTradeHelper" },
      to: [mail.toName ? { email: mail.to, name: mail.toName } : { email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Could not send email (Brevo ${res.status}): ${body.slice(0, 200)}`);
  }
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function verificationMail(to: string, name: string | null, code: string, minutes: number): Mail {
  const hello = name ? `Hi ${name},` : "Hi,";
  return {
    to,
    toName: name,
    subject: `Your HxTradeHelper confirmation code: ${code}`,
    text: `${hello}\n\nYour HxTradeHelper confirmation code is ${code}\n\nIt expires in ${minutes} minutes. If you didn't sign up, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#222">
<p>${escapeHtml(hello)}</p>
<p>Your HxTradeHelper confirmation code is</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p style="color:#666">It expires in ${minutes} minutes. If you didn't sign up, you can ignore this email.</p>
</div>`,
  };
}

export function resetCodeMail(to: string, name: string | null, code: string, minutes: number): Mail {
  const hello = name ? `Hi ${name},` : "Hi,";
  return {
    to,
    toName: name,
    subject: `Your HxTradeHelper password reset code: ${code}`,
    text: `${hello}\n\nYour HxTradeHelper password reset code is ${code}\n\nIt expires in ${minutes} minutes. If you didn't ask to reset your password, you can ignore this email - your password stays the same.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#222">
<p>${escapeHtml(hello)}</p>
<p>Your HxTradeHelper password reset code is</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p style="color:#666">It expires in ${minutes} minutes. If you didn't ask to reset your password, you can ignore this email - your password stays the same.</p>
</div>`,
  };
}

export function passwordResetMail(to: string, name: string | null, password: string): Mail {
  const hello = name ? `Hi ${name},` : "Hi,";
  return {
    to,
    toName: name,
    subject: "Your HxTradeHelper password was reset",
    text: `${hello}\n\nAn administrator reset your HxTradeHelper password. Your new password is:\n\n${password}\n\nPlease sign in and change it on the Settings page.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#222">
<p>${escapeHtml(hello)}</p>
<p>An administrator reset your HxTradeHelper password. Your new password is:</p>
<p style="font-size:18px;font-family:monospace">${escapeHtml(password)}</p>
<p style="color:#666">Please sign in and change it on the Settings page.</p>
</div>`,
  };
}
