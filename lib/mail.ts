import nodemailer, { type Transporter } from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

let smtpTransporter: Transporter | null = null;

function smtpTransport(): Transporter | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtpdm.aliyun.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== "false",
      auth: { user, pass }
    });
  }
  return smtpTransporter;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const from =
    process.env.MORROW_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || "";
  const smtp = smtpTransport();

  if (smtp) {
    try {
      await smtp.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html
      });
      return true;
    } catch (error) {
      console.error(
        "[morrow:mail] SMTP 发信失败：",
        error instanceof Error ? error.message : error
      );
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !from) {
    console.info(`[morrow:mail] ${input.subject} -> ${input.to}`);
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html
    })
  });
  return response.ok;
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<{ sent: boolean; devUrl: string | null }> {
  const appUrl = (process.env.MORROW_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: email,
    subject: "欢迎来到 Morrow：验证你的邮箱",
    html: `<p>欢迎来到 Morrow / 点滴美好。</p><p><a href="${verifyUrl}">点击这里验证邮箱并进入广场</a></p><p>这条链接 24 小时内有效。</p>`
  });
  return {
    sent,
    devUrl: process.env.NODE_ENV === "production" ? null : verifyUrl
  };
}
