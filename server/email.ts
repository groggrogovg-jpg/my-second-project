import { createTransport, type Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_ADDRESS = "noreply@kardomatik.ru";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[email] SMTP не настроен: отсутствуют SMTP_HOST, SMTP_USER или SMTP_PASS");
    return null;
  }
  const secure = SMTP_PORT === 465;
  transporter = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

export interface SendResetEmailParams {
  to: string;
  resetUrl: string;
}

/**
 * Отправляет письмо для восстановления пароля через SMTP (Beget).
 * В случае ошибки логирует её, но не выбрасывает исключение наружу —
 * endpoint должен возвращать нейтральный ответ независимо от доставки.
 */
export async function sendPasswordResetEmail({ to, resetUrl }: SendResetEmailParams): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[email] Транспорт SMTP не создан — письмо не отправлено");
    return;
  }

  const sender = FROM_ADDRESS;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin-top: 0; color: #111827;">Восстановление пароля в КардоМатик</h2>
      <p>Вы запросили сброс пароля для аккаунта <strong>${to}</strong>.</p>
      <p>Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действительна <strong>1 час</strong> и может быть использована только один раз.</p>
      <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">Сбросить пароль</a>
      <p style="font-size: 13px; color: #6b7280;">Если кнопка не работает, скопируйте ссылку в браузер: <br><a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af;">Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо. Ваш текущий пароль останется без изменений.</p>
    </div>
  `;

  const text = `Восстановление пароля в КардоМатик\n\nВы запросили сброс пароля для аккаунта ${to}.\n\nПерейдите по ссылке, чтобы задать новый пароль:\n${resetUrl}\n\nСсылка действительна 1 час и может быть использована только один раз.\n\nЕсли вы не запрашивали восстановление пароля, проигнорируйте это письмо.`;

  try {
    await transport.sendMail({
      from: `КардоМатик <${sender}>`,
      to,
      subject: "Восстановление пароля в КардоМатик",
      text,
      html,
    });
    console.log(`[email] Письмо для восстановления пароля отправлено на ${to}`);
  } catch (err: any) {
    console.error(`[email] Ошибка отправки письма на ${to}:`, err.message || err);
    // Не пробрасываем ошибку — не раскрываем пользователю технические детали.
  }
}
