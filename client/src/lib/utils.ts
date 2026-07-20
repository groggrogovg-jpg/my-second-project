import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSubscriptionExpiry(expiresAt: string, balance: number): string {
  if (balance <= 0) return "Нет активных карточек";
  const date = new Date(expiresAt);
  const now = new Date();
  if (date <= now) return "Срок истёк";
  const days = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return `Действует ${days} дн. (до ${date.toLocaleDateString("ru-RU")})`;
}
