import "server-only";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

/** JSON error in the visitor's language, plus a stable code for tests and clients. */
export async function apiError(code: string, status: number, values?: Record<string, string | number>) {
  const t = await getTranslations("api");
  return NextResponse.json({ error: t(code, values), code }, { status });
}
