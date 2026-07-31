"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  type MedidasSnapshot,
  type MesocicloInput,
  type PeriodoInput,
  type SemanaInput,
  type TipoEtapa,
  type TipoPeriodo,
  type Vo2maxSnapshot,
  calcularVo2maxLeger,
  isMetodoVo2max,
  isObjetivoTipo,
  isTipoMesociclo,
  isTipoMicrociclo,
  isTipoPeriodo,
  parseDateInput,
  velocidadLegerKmh,
} from "@/lib/macrociclo";
import {
  activarMacrociclo,
  cerrarMacrociclo,
  crearORecuperarBorrador,
  eliminarMacrociclo,
  guardarMedidasSnapshot,
  guardarPeriodizacion,
  guardarPasoObjetivoFechas,
  guardarRmSnapshot,
  guardarVo2maxSnapshot,
} from "@/services/macrociclo.service";

function getContext() {
  return { userType: "persona" as const };
}

async function getPersona(cc: string) {
  return prisma.persona.findUnique({ where: { cc } });
}

function getString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, name: string): number | null {
  const value = getString(formData, name);
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getInt(formData: FormData, name: string): number | null {
  const value = getString(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function getBoolean(formData: FormData, name: string): boolean {
  const value = getString(formData, name);
  return value === "true" || value === "1" || value === "on";
}

function redirectToWizard(
  cc: string,
  macrocicloId: number,
  step?: number,
): never {
  const stepQuery = step ? `&paso=${step}` : "";
  redirect(
    `/macrociclo/${macrocicloId}/editar?cc=${encodeURIComponent(cc)}${stepQuery}`,
  );
}

export async function iniciarMacrocicloAction(formData: FormData) {
  const cc = getString(formData, "cc");
  if (!cc) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  const { macrociclo } = await crearORecuperarBorrador({
    personaId: persona.id,
    cc,
    context: getContext(),
  });

  redirectToWizard(cc, macrociclo.id, macrociclo.pasoActual);
}

export async function guardarPasoObjetivoFechasAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const objetivoTipo = getString(formData, "objetivoTipo");
  const objetivoDetalle = getString(formData, "objetivoDetalle");
  const fechaInicioRaw = getString(formData, "fechaInicio");
  const fechaFinRaw = getString(formData, "fechaFin");
  const fechaCompetenciaRaw = getString(formData, "fechaCompetencia");

  if (!cc || !id || !isObjetivoTipo(objetivoTipo)) {
    redirect("/");
  }

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  const fechaInicio = parseDateInput(fechaInicioRaw);
  const fechaFin = parseDateInput(fechaFinRaw);
  const fechaCompetencia = fechaCompetenciaRaw
    ? parseDateInput(fechaCompetenciaRaw)
    : undefined;

  if (!fechaInicio || !fechaFin) {
    redirectToWizard(cc, id, 1);
  }

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/");

  await guardarPasoObjetivoFechas({
    id,
    personaId: persona.id,
    objetivoTipo,
    objetivoDetalle,
    fechaInicio: fechaInicio,
    fechaFin: fechaFin,
    fechaCompetencia: fechaCompetencia ?? undefined,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, 2);
}

export async function guardarMedidasAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const medidasRaw = getString(formData, "medidas");
  const actualizarPersona = getBoolean(formData, "actualizarPersona");

  if (!cc || !id || !medidasRaw) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  let medidas: MedidasSnapshot | null = null;
  try {
    medidas = JSON.parse(medidasRaw) as MedidasSnapshot;
  } catch {
    redirectToWizard(cc, id, 3);
  }

  if (!medidas) redirectToWizard(cc, id, 3);

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/");

  await guardarMedidasSnapshot({
    id,
    personaId: persona.id,
    medidas,
    actualizarPersona,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, 4);
}

export async function guardarRmAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const sesionRmId = getInt(formData, "sesionRmId");

  if (!cc || !id || !sesionRmId) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  const sesion = await prisma.sesion.findFirst({
    where: { id: sesionRmId, personaId: persona.id },
    include: {
      resultados: {
        include: {
          ejercicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (!sesion) redirectToWizard(cc, id, 4);

  const rmSnapshot = {
    sesionId: sesion.id,
    peso: sesion.peso,
    rmMethod: sesion.rmMethod,
    estimatedRM: sesion.estimatedRM,
    finalRM: sesion.finalRM,
    protocolData: sesion.protocolData,
    resultados: sesion.resultados.map((r) => ({
      ejercicioId: r.ejercicioId,
      ejercicioNombre: r.ejercicio.nombre,
      repeticiones: r.repeticiones,
      carga: r.carga,
      epley: r.epley,
      brzycki: r.brzycki,
    })),
  };

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/");

  await guardarRmSnapshot({
    id,
    personaId: persona.id,
    sesionRmId,
    rmSnapshot,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, 5);
}

export async function guardarVo2maxAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const metodo = getString(formData, "metodo");

  if (!cc || !id || !isMetodoVo2max(metodo)) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  let vo2max: Vo2maxSnapshot;

  if (metodo === "cooper") {
    const distancia = getNumber(formData, "distanciaMetros");
    if (!distancia || distancia <= 0) redirectToWizard(cc, id, 5);
    const valor = (distancia - 504.9) / 44.73;
    vo2max = { metodo, distanciaMetros: distancia, valor };
  } else if (metodo === "directo") {
    const valor = getNumber(formData, "valor");
    if (!valor || valor <= 0) redirectToWizard(cc, id, 5);
    vo2max = { metodo, valor };
  } else {
    const etapa = getNumber(formData, "etapa");

    if (!etapa || etapa < 1 || !Number.isInteger(etapa)) {
      redirectToWizard(cc, id, 5);
    }

    const etapaFinal = etapa as number;
    vo2max = {
      metodo,
      etapa: etapaFinal,
      velocidadKmh: velocidadLegerKmh(etapaFinal),
      valor: calcularVo2maxLeger(etapaFinal),
    };
  }

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/");

  await guardarVo2maxSnapshot({
    id,
    personaId: persona.id,
    vo2max,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, 6);
}

type PeriodizacionPayload = {
  cc: string;
  id: number;
  periodos: PeriodoInput[];
  etapasPorPeriodo: Record<
    TipoPeriodo,
    { tipo: TipoEtapa; porcentaje: number }[]
  >;
  mesociclos: MesocicloInput[];
  semanas: SemanaInput[];
};

async function parsePeriodizacionFormData(
  formData: FormData,
): Promise<PeriodizacionPayload | { error: string }> {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const periodosRaw = getString(formData, "periodos");
  const etapasRaw = getString(formData, "etapas");
  const mesociclosRaw = getString(formData, "mesociclos");
  const semanasRaw = getString(formData, "semanas");

  if (
    !cc ||
    !id ||
    !periodosRaw ||
    !etapasRaw ||
    !mesociclosRaw ||
    !semanasRaw
  ) {
    return { error: "Faltan datos para guardar la periodización." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { error: "Persona no encontrada." };
  }

  let periodos: PeriodoInput[] | null = null;
  let etapasPorPeriodo: Record<
    TipoPeriodo,
    { tipo: TipoEtapa; porcentaje: number }[]
  > | null = null;
  let mesociclos: MesocicloInput[] | null = null;
  let semanas: SemanaInput[] | null = null;

  try {
    periodos = JSON.parse(periodosRaw) as PeriodoInput[];
    etapasPorPeriodo = JSON.parse(etapasRaw) as typeof etapasPorPeriodo;
    mesociclos = JSON.parse(mesociclosRaw) as MesocicloInput[];
    semanas = JSON.parse(semanasRaw) as SemanaInput[];
  } catch {
    return { error: "Formato de datos inválido." };
  }

  if (!periodos || !etapasPorPeriodo || !mesociclos || !semanas) {
    return { error: "Formato de datos inválido." };
  }

  const periodosValidos = periodos.filter((p) => isTipoPeriodo(p.tipo));
  const mesociclosValidos = mesociclos.filter((m) => isTipoMesociclo(m.tipo));
  const semanasValidas = semanas.filter(
    (s) =>
      Number.isInteger(s.numeroSemana) &&
      s.numeroSemana > 0 &&
      isTipoMicrociclo(s.tipoMicrociclo),
  );

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) {
    return { error: "Macrociclo no encontrado." };
  }

  try {
    await guardarPeriodizacion({
      id,
      personaId: persona.id,
      periodos: periodosValidos,
      etapasPorPeriodo,
      mesociclos: mesociclosValidos,
      semanas: semanasValidas,
      pasoActual: macrociclo.pasoActual,
      context: getContext(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al guardar la periodización.";
    return { error: message };
  }

  return {
    cc,
    id,
    periodos: periodosValidos,
    etapasPorPeriodo,
    mesociclos: mesociclosValidos,
    semanas: semanasValidas,
  };
}

export async function guardarPeriodizacionAction(formData: FormData) {
  const result = await parsePeriodizacionFormData(formData);

  if ("error" in result) {
    const cc = getString(formData, "cc");
    const id = getInt(formData, "id");
    if (!cc || !id) redirect("/");
    redirect(
      `/macrociclo/${id}/editar?cc=${encodeURIComponent(cc)}&paso=10&error=${encodeURIComponent(result.error)}`,
    );
  }

  redirectToWizard(result.cc, result.id, 10);
}

export async function guardarPeriodizacionSinRedirectAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await parsePeriodizacionFormData(formData);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

export async function activarMacrocicloAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");

  if (!cc || !id) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  try {
    await activarMacrociclo({
      id,
      personaId: persona.id,
      context: getContext(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo activar el macrociclo.";
    redirect(
      `/macrociclo/${id}?cc=${encodeURIComponent(cc)}&error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/macrociclo/${id}?cc=${encodeURIComponent(cc)}`);
}

export async function cerrarMacrocicloAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");

  if (!cc || !id) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  await cerrarMacrociclo({ id, personaId: persona.id, context: getContext() });

  redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
}

export async function eliminarMacrocicloAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");

  if (!cc || !id) redirect("/");

  const persona = await getPersona(cc);
  if (!persona) redirect("/");

  await eliminarMacrociclo({
    id,
    personaId: persona.id,
    context: getContext(),
  });

  redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
}

export async function procesarPdfAntropometriaAction(
  formData: FormData,
): Promise<
  | { success: true; medidas: MedidasSnapshot; reconocido: boolean }
  | { success: false; error: string }
> {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const archivo = formData.get("archivo");

  if (!cc || !id) {
    return { success: false, error: "Sesión inválida." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { success: false, error: "Persona no encontrada." };
  }

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) {
    return { success: false, error: "Macrociclo no encontrado." };
  }

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { success: false, error: "Debes seleccionar un archivo PDF." };
  }

  try {
    const bytes = await archivo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { extraerAntropometriaDesdePdf } =
      await import("@/lib/pdf-antropometria");
    const { medidas, reconocido } = await extraerAntropometriaDesdePdf(buffer);

    return { success: true, medidas, reconocido };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al procesar PDF.";
    return { success: false, error: message };
  }
}
