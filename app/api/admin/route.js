import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (!adminPassword || !scriptUrl || !scriptSecret) {
    return NextResponse.json({ error: "La configuration Google de l’application est incomplète." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ error: "Mot de passe administrateur incorrect." }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, secret: scriptSecret }),
      cache: "no-store"
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      return NextResponse.json({ error: result.error || "Le service Google a refusé la requête." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Impossible de joindre Google Apps Script. Vérifiez son URL et son déploiement." }, { status: 502 });
  }
}