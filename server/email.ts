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

export interface SendPaymentConfirmationEmailParams {
  to: string;
  packageName: string;
  cardsIncluded: number;
  starsToAdd: number;
  amount: string;
  paidAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Отправляет подтверждение успешной оплаты.
 * Ошибки доставки намеренно не пробрасываются: баланс уже начислен
 * и не должен зависеть от доступности SMTP.
 */
export async function sendPaymentConfirmationEmail({
  to,
  packageName,
  cardsIncluded,
  starsToAdd,
  amount,
  paidAt,
}: SendPaymentConfirmationEmailParams): Promise<void> {
  const recipient = to.trim();
  if (!recipient) {
    console.error("[email] Подтверждение оплаты не отправлено: у пользователя нет email");
    return;
  }

  const transport = getTransporter();
  if (!transport) {
    console.error(`[email] Подтверждение оплаты для ${recipient} не отправлено: SMTP не настроен`);
    return;
  }

  const safePackageName = escapeHtml(packageName);
  const safeAmount = escapeHtml(`${amount} ₽`);
  const formattedDate = paidAt.toLocaleString("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  });
  const quantityLines = [
    cardsIncluded > 0 ? `Карточки: ${cardsIncluded}` : "",
    starsToAdd > 0 ? `Звёзды: ${starsToAdd} ⭐` : "",
  ].filter(Boolean);
  const quantityText = quantityLines.join("\n");
  const quantityHtml = quantityLines
    .map((line) => `<li style="margin: 4px 0;">${escapeHtml(line)}</li>`)
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin-top: 0; color: #111827;">Спасибо за оплату в КардоМатик!</h2>
      <p>Здравствуйте!</p>
      <p>Ваш платёж успешно обработан, и покупка уже начислена на баланс аккаунта.</p>
      <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb;">
        <p style="margin: 0 0 10px;"><strong>Пакет:</strong> ${safePackageName}</p>
        <p style="margin: 0 0 10px;"><strong>Количество:</strong></p>
        <ul style="margin: 0 0 10px; padding-left: 20px;">${quantityHtml}</ul>
        <p style="margin: 0 0 10px;"><strong>Сумма:</strong> ${safeAmount}</p>
        <p style="margin: 0;"><strong>Дата и время:</strong> ${escapeHtml(formattedDate)} (МСК)</p>
      </div>
      <p>Спасибо, что пользуетесь КардоМатик.</p>
      <p style="font-size: 12px; color: #9ca3af;">Если вы не совершали эту оплату, обратитесь в поддержку.</p>
    </div>
  `;
  const text = [
    "Спасибо за оплату в КардоМатик!",
    "",
    "Здравствуйте!",
    "Ваш платёж успешно обработан, и покупка уже начислена на баланс аккаунта.",
    "",
    `Пакет: ${packageName}`,
    quantityText,
    `Сумма: ${amount} ₽`,
    `Дата и время: ${formattedDate} (МСК)`,
    "",
    "Спасибо, что пользуетесь КардоМатик.",
  ].join("\n");

  try {
    await transport.sendMail({
      from: `КардоМатик <${FROM_ADDRESS}>`,
      to: recipient,
      subject: `Оплата подтверждена — ${packageName}`,
      text,
      html,
    });
    console.log(`[email] Подтверждение оплаты отправлено на ${recipient}`);
  } catch (err: any) {
    console.error(`[email] Ошибка отправки подтверждения оплаты на ${recipient}:`, err.message || err);
  }
}
