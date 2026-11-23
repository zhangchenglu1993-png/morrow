import { sendEmail } from "../lib/mail";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("用法: npm run mail:test -- you@example.com");
    process.exit(1);
  }
  const ok = await sendEmail({
    to,
    subject: "Morrow 发信测试",
    html: "<p>如果你收到这封邮件，说明发信配置正常。</p><p>—— Morrow / 点滴美好</p>"
  });
  console.log(ok ? "MAIL_SENT" : "MAIL_NOT_SENT");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
