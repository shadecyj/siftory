import { NextResponse } from "next/server";
import { isLocale } from "../../../../lib/i18n/locale";
import { readLocalePreference, saveLocalePreference } from "../../../../lib/server/locale-preference";
import { rejectUntrustedMutationRequest } from "../../../../lib/server/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const preference = readLocalePreference();
  return NextResponse.json({ locale: preference?.locale ?? null, updatedAt: preference?.updatedAt ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  try {
    const body: unknown = await request.json();
    const locale = body && typeof body === "object" ? (body as { locale?: unknown }).locale : undefined;
    if (!isLocale(locale)) return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
    return NextResponse.json(saveLocalePreference(locale), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
  }
}
