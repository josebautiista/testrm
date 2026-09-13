// Constantes y utilidades puras de M7 (ejecución). Sin Prisma — mismo
// criterio que lib/ejercicio-catalogo.ts: components/entrenamiento/** las
// necesita en el cliente.

/**
 * Motivos por los que se puede omitir una sesión. Se codifican como prefijo
 * en `SesionRealizada.motivoOmision` (no hay columna aparte en el schema)
 * para poder distinguir "fatiga" de forma fiable — es lo que permite que
 * R-10 (deload reactivo, criterio "sesionesOmitidasPorFatiga") funcione sin
 * adivinar la razón a partir de texto libre.
 */
export const MOTIVOS_OMISION_SESION = [
  { codigo: "fatiga", label: "Fatiga o cansancio acumulado" },
  { codigo: "lesion", label: "Lesión o molestia física" },
  { codigo: "logistica", label: "No pudo asistir (trabajo, viaje, agenda)" },
  { codigo: "otro", label: "Otro motivo" },
] as const;

export type CodigoMotivoOmision = (typeof MOTIVOS_OMISION_SESION)[number]["codigo"];

export function esCodigoMotivoOmision(value: unknown): value is CodigoMotivoOmision {
  return (
    typeof value === "string" &&
    MOTIVOS_OMISION_SESION.some((m) => m.codigo === value)
  );
}

const PREFIJO_RE = /^\[(\w+)\](?:\s([\s\S]*))?$/;

/** Codifica motivo + detalle libre en el único campo `motivoOmision` disponible. */
export function codificarMotivoOmision(
  codigo: CodigoMotivoOmision,
  detalle?: string | null,
): string {
  const detalleLimpio = detalle?.trim();
  return detalleLimpio ? `[${codigo}] ${detalleLimpio}` : `[${codigo}]`;
}

export function decodificarMotivoOmision(motivo: string | null): {
  codigo: CodigoMotivoOmision | null;
  detalle: string;
} {
  if (!motivo) {
    return { codigo: null, detalle: "" };
  }

  const match = motivo.match(PREFIJO_RE);
  if (!match || !esCodigoMotivoOmision(match[1])) {
    return { codigo: null, detalle: motivo };
  }

  return { codigo: match[1], detalle: match[2] ?? "" };
}

export function esOmisionPorFatiga(motivo: string | null): boolean {
  return decodificarMotivoOmision(motivo).codigo === "fatiga";
}
