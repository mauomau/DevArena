import { jsonError, parseJsonBody } from "../../../../lib/server/apiUtils";
import { listScores } from "../../../../lib/server/scoreStore";
import { resetAllCompetitionData } from "../../../../lib/server/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasStandAuthorization(request: Request): boolean {
  const secret = process.env.STAND_SECRET_KEY?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerKey = request.headers.get("x-stand-key")?.trim();
  if (headerKey === secret) return true;

  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "stand_auth" && rest.join("=") === secret) {
      return true;
    }
  }

  return false;
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * GET /api/admin/scores
 * Exporte le classement courant au format CSV (UTF-8 avec BOM pour Excel).
 */
export async function GET(request: Request): Promise<Response> {
  if (!hasStandAuthorization(request)) {
    return jsonError("Accès réservé aux PC du stand Club Dev ESGIS.", 403);
  }

  try {
    const snapshot = await listScores();
    const header = [
      "Rang",
      "Pseudo",
      "Filiere",
      "Score",
      "Niveau",
      "TempsTotalSec",
      "DateMiseAJour",
    ].join(",");

    const lines = snapshot.entries.map((entry, index) =>
      [
        index + 1,
        entry.pseudo,
        entry.filiere,
        entry.score,
        entry.currentLevel,
        entry.totalTimeSeconds,
        entry.updatedAt,
      ]
        .map(escapeCsvCell)
        .join(","),
    );

    const csv = `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="devarena-scores-${dateStamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/admin/scores] export CSV impossible", error);
    return jsonError("Export CSV impossible.", 500);
  }
}

/**
 * DELETE /api/admin/scores
 * Vide les scores de test, les sessions et les PIN associés avant l'événement.
 */
export async function DELETE(request: Request): Promise<Response> {
  if (!hasStandAuthorization(request)) {
    return jsonError("Accès réservé aux PC du stand Club Dev ESGIS.", 403);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.value as Record<string, unknown> | null;
  if (!body || body.confirm !== "RESET_ALL_SCORES") {
    return jsonError(
      'Confirmation requise : { "confirm": "RESET_ALL_SCORES" }.',
      400,
    );
  }

  try {
    await resetAllCompetitionData();
    return Response.json({ ok: true, cleared: true });
  } catch (error) {
    console.error("[api/admin/scores] réinitialisation impossible", error);
    return jsonError("Réinitialisation des scores impossible.", 500);
  }
}
