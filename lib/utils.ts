import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INTL_LOCALE: Record<string, string> = { vi: "vi-VN", en: "en-GB" };

export function formatDate(value?: string | null, locale = "vi") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null, locale = "vi") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function slugify(value: string) {
  return value
    // Strip Vietnamese (and other) diacritics: "Đám cưới" -> "dam cuoi".
    // Without this, "Đám cưới Minh & Lan" became "m-c-i-minh-lan".
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function makeStoragePathSegment(value: string) {
  const ascii = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  return ascii.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-{2,}/g, "-") || "photo";
}
