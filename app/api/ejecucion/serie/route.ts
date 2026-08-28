// TASK-038 · POST /api/ejecucion/serie — registro rápido de una serie desde
// el móvil, con idempotencia por requestId (mismo patrón que Sesion.requestId).
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { registrarSerie } from "@/services/ejecucion.service";

type SeriePayload = {
  sesionRealizadaId?: unknown;
  prescripcionId?: unknown;
  ejercicioId?: unknown;
  numeroSerie?: unknown;
  cargaKg?: unknown;
  repeticiones?: unknown;
  rir?: unknown;
  fallo?: unknown;
  requestId?: unknown;
};

function toInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cc = searchParams.get("cc")?.trim() ?? "";

    if (!cc) {
      return NextResponse.json(
        { error: "Debes enviar el CC de la persona." },
        { status: 400 },
      );
    }

    const persona = await prisma.persona.findUnique({
      where: { cc },
      select: { id: true },
    });

    if (!persona) {
      return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
    }

    const payload = (await request.json()) as SeriePayload;

    const sesionRealizadaId = toInt(payload.sesionRealizadaId);
    const ejercicioId = toInt(payload.ejercicioId);
    const numeroSerie = toInt(payload.numeroSerie);
    const cargaKg = toNumber(payload.cargaKg);
    const repeticiones = toInt(payload.repeticiones);
    const rir = payload.rir === undefined || payload.rir === null ? null : toInt(payload.rir);
    const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : null;

    if (
      !sesionRealizadaId ||
      !ejercicioId ||
      !numeroSerie ||
      cargaKg === null ||
      cargaKg < 0 ||
      !repeticiones ||
      repeticiones <= 0
    ) {
      return NextResponse.json(
        { error: "sesionRealizadaId, ejercicioId, numeroSerie, cargaKg y repeticiones son obligatorios." },
        { status: 422 },
      );
    }

    const sesionRealizada = await prisma.sesionRealizada.findUnique({
      where: { id: sesionRealizadaId },
      select: { personaId: true },
    });

    if (!sesionRealizada || sesionRealizada.personaId !== persona.id) {
      return NextResponse.json(
        { error: "La sesión realizada no existe o no pertenece a esta persona." },
        { status: 404 },
      );
    }

    const serie = await registrarSerie(
      {
        sesionRealizadaId,
        prescripcionId: toInt(payload.prescripcionId),
        ejercicioId,
        numeroSerie,
        cargaKg,
        repeticiones,
        rir,
        fallo: Boolean(payload.fallo),
        requestId,
      },
      persona.id,
    );

    return NextResponse.json({ serie }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "JSON inválido en la solicitud." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "No fue posible registrar la serie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
