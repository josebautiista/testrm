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
  PASO_WIZARD,
} from "@/lib/macrociclo";
import {
  activarMacrociclo,
  cerrarMacrociclo,
  crearORecuperarBorrador,
  eliminarMacrociclo,
  guardarMedidasSnapshot,
  guardarPasoObjetivoFechas,
  guardarPeriodizacion,
  guardarRmSnapshot,
  guardarVo2maxSnapshot,
  guardarCargaMesociclo,
  guardarPerfilDeportivo,
  guardarCompetencias,
} from "@/services/macrociclo.service";
import {
  isCapacidadDominante,
  isEstructuraCalendario,
  isNivelAtleta,
  PERFIL_POR_DEFECTO,
} from "@/lib/planificacion/perfil";
import { type CargaMesocicloInputData } from "@/lib/mesociclo-carga";
import { combinarResultadosRmMasRecientes } from "@/lib/macrociclo-rm";

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
  if (!cc) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  const { macrociclo } = await crearORecuperarBorrador({
    personaId: persona.id,
    cc,
    context: getContext(),
  });

  redirectToWizard(cc, macrociclo.id, macrociclo.pasoActual);
}


/**
 * ADR-37 · Guarda los tres descriptores del perfil deportivo. Cualquier valor
 * no reconocido cae al del perfil por defecto en vez de rechazar el guardado:
 * el perfil se puede corregir después, y bloquear el avance del asistente por
 * un valor suelto sería peor.
 */
export async function guardarPerfilDeportivoAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const capacidad = getString(formData, "capacidadDominante");
  const calendario = getString(formData, "estructuraCalendario");
  const nivel = getString(formData, "nivelAtleta");

  if (!cc || !id) {
    return { error: "Faltan datos para guardar el perfil." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { error: "Persona no encontrada." };
  }

  try {
    await guardarPerfilDeportivo({
      id,
      personaId: persona.id,
      perfil: {
        capacidad: isCapacidadDominante(capacidad)
          ? capacidad
          : PERFIL_POR_DEFECTO.capacidad,
        calendario: isEstructuraCalendario(calendario)
          ? calendario
          : PERFIL_POR_DEFECTO.calendario,
        nivel: isNivelAtleta(nivel) ? nivel : PERFIL_POR_DEFECTO.nivel,
      },
      context: getContext(),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Error al guardar el perfil.",
    };
  }

  return { success: true as const };
}

/** ADR-38 · Reemplaza el calendario de competencias del macrociclo. */
export async function guardarCompetenciasAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const raw = getString(formData, "competencias");

  if (!cc || !id) {
    return { error: "Faltan datos para guardar las competencias." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { error: "Persona no encontrada." };
  }

  let parsed: Array<{ nombre?: unknown; fecha?: unknown; importancia?: unknown }>;
  try {
    parsed = raw ? (JSON.parse(raw) as typeof parsed) : [];
  } catch {
    return { error: "Formato de competencias inválido." };
  }

  const competencias = parsed
    .map((item) => {
      const fecha =
        typeof item.fecha === "string" ? parseDateInput(item.fecha) : null;
      if (!fecha) return null;

      return {
        nombre:
          typeof item.nombre === "string" && item.nombre.trim() !== ""
            ? item.nombre.trim()
            : "Competencia",
        fecha,
        importancia:
          item.importancia === "principal"
            ? ("principal" as const)
            : ("secundaria" as const),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  try {
    await guardarCompetencias({
      id,
      personaId: persona.id,
      competencias,
      context: getContext(),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Error al guardar las competencias.",
    };
  }

  return { success: true as const };
}

export async function guardarPasoObjetivoFechasAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const objetivoTipo = getString(formData, "objetivoTipo");
  const objetivoDetalle = getString(formData, "objetivoDetalle");
  const fechaInicioRaw = getString(formData, "fechaInicio");
  const fechaFinRaw = getString(formData, "fechaFin");

  if (!cc || !id || !isObjetivoTipo(objetivoTipo)) {
    redirect("/atletas");
  }

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  const fechaInicio = parseDateInput(fechaInicioRaw);
  const fechaFin = parseDateInput(fechaFinRaw);
  if (!fechaInicio || !fechaFin) {
    redirectToWizard(cc, id, PASO_WIZARD.objetivo);
  }

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/atletas");

  await guardarPasoObjetivoFechas({
    id,
    personaId: persona.id,
    objetivoTipo,
    objetivoDetalle,
    fechaInicio: fechaInicio,
    fechaFin: fechaFin,
    // M-03/ADR-41: `fechaCompetencia` ya no llega desde este paso. La fuente
    // única es el calendario del paso de perfil, que la repuebla con la
    // primera competencia principal.
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, PASO_WIZARD.perfil);
}

export async function guardarMedidasAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const medidasRaw = getString(formData, "medidas");
  const actualizarPersona = getBoolean(formData, "actualizarPersona");

  if (!cc || !id || !medidasRaw) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  let medidas: MedidasSnapshot | null = null;
  try {
    medidas = JSON.parse(medidasRaw) as MedidasSnapshot;
  } catch {
    redirectToWizard(cc, id, PASO_WIZARD.rm);
  }

  if (!medidas) redirectToWizard(cc, id, PASO_WIZARD.rm);

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/atletas");

  await guardarMedidasSnapshot({
    id,
    personaId: persona.id,
    medidas,
    actualizarPersona,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, PASO_WIZARD.rm);
}

export async function guardarRmAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const sesionRmIds = [...new Set(
    formData
      .getAll("sesionRmIds")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (!cc || !id || sesionRmIds.length === 0) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  const sesiones = await prisma.sesion.findMany({
    where: { id: { in: sesionRmIds }, personaId: persona.id },
    orderBy: { createdAt: "desc" },
    include: {
      resultados: {
        include: {
          ejercicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (sesiones.length !== sesionRmIds.length) {
    redirectToWizard(cc, id, PASO_WIZARD.rm);
  }

  const resultadosRecientes = combinarResultadosRmMasRecientes(sesiones);

  const serializarResultado = (
    r: (typeof sesiones)[number]["resultados"][number],
  ) => ({
    ejercicioId: r.ejercicioId,
    ejercicioNombre: r.ejercicio.nombre,
    ejercicio: { nombre: r.ejercicio.nombre },
    repeticiones: r.repeticiones,
    carga: r.carga,
    epley: r.epley,
    brzycki: r.brzycki,
    lombardi: r.lombardi,
    lander: r.lander,
    oconnor: r.oconnor,
    mayhew: r.mayhew,
    wathen: r.wathen,
    baechle: r.baechle,
    casas: r.casas,
    nacleiro: r.nacleiro,
  });

  const rmSnapshot = {
    sesionIds: sesiones.map((sesion) => sesion.id),
    sesiones: sesiones.map((sesion) => ({
      sesionId: sesion.id,
      fecha: sesion.createdAt.toISOString(),
      peso: sesion.peso,
      rmMethod: sesion.rmMethod,
      estimatedRM: sesion.estimatedRM,
      finalRM: sesion.finalRM,
      protocolData: sesion.protocolData,
      resultados: sesion.resultados.map(serializarResultado),
    })),
    // Al estar ordenadas de más reciente a más antigua, el primer resultado
    // de cada ejercicio es el que manda cuando hay duplicados.
    resultados: resultadosRecientes.map(serializarResultado),
  };

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/atletas");

  await guardarRmSnapshot({
    id,
    personaId: persona.id,
    sesionRmId: sesiones[0].id,
    sesionRmIds: sesiones.map((sesion) => sesion.id),
    rmSnapshot,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, PASO_WIZARD.vo2max);
}

export async function guardarVo2maxAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const metodo = getString(formData, "metodo");

  if (!cc || !id || !isMetodoVo2max(metodo)) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  let vo2max: Vo2maxSnapshot;

  if (metodo === "cooper") {
    const distancia = getNumber(formData, "distanciaMetros");
    if (!distancia || distancia <= 0) redirectToWizard(cc, id, PASO_WIZARD.vo2max);
    const valor = (distancia - 504.9) / 44.73;
    vo2max = { metodo, distanciaMetros: distancia, valor };
  } else {
    const etapa = getNumber(formData, "etapa");

    if (!etapa || etapa < 1 || !Number.isInteger(etapa)) {
      redirectToWizard(cc, id, PASO_WIZARD.vo2max);
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
  if (!macrociclo) redirect("/atletas");

  await guardarVo2maxSnapshot({
    id,
    personaId: persona.id,
    vo2max,
    pasoActual: macrociclo.pasoActual,
    context: getContext(),
  });

  redirectToWizard(cc, id, PASO_WIZARD.estructura);
}

export async function omitirVo2maxAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");

  if (!cc || !id) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId: persona.id },
  });
  if (!macrociclo) redirect("/atletas");

  redirectToWizard(cc, id, PASO_WIZARD.estructura);
}

type PeriodizacionPayload = {
  cc: string;
  id: number;
  semanas: SemanaInput[];
};

async function parsePeriodizacionFormData(
  formData: FormData,
): Promise<PeriodizacionPayload | { error: string }> {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const semanasRaw = getString(formData, "semanas");

  // ADR-37: la estructura (periodos, etapas, mesociclos) ya no llega desde el
  // formulario — se deriva del perfil deportivo guardado. Del formulario solo
  // vienen los valores de carga por semana.
  if (!cc || !id || !semanasRaw) {
    return { error: "Faltan datos para guardar la periodización." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { error: "Persona no encontrada." };
  }

  let semanas: SemanaInput[] | null = null;

  try {
    semanas = JSON.parse(semanasRaw) as SemanaInput[];
  } catch {
    return { error: "Formato de datos inválido." };
  }

  if (!semanas) {
    return { error: "Formato de datos inválido." };
  }

  const semanasValidas = semanas.filter(
    (s) =>
      Number.isInteger(s.numeroSemana) &&
      s.numeroSemana > 0 &&
      isTipoMicrociclo(s.tipoMicrociclo) &&
      Array.isArray(s.ejercicios),
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
    semanas: semanasValidas,
  };
}

export async function guardarPeriodizacionAction(formData: FormData) {
  const result = await parsePeriodizacionFormData(formData);

  if ("error" in result) {
    const cc = getString(formData, "cc");
    const id = getInt(formData, "id");
    if (!cc || !id) redirect("/atletas");
    redirect(
      `/macrociclo/${id}/editar?cc=${encodeURIComponent(cc)}&paso=${PASO_WIZARD.semanas}&error=${encodeURIComponent(result.error)}`,
    );
  }

  redirectToWizard(result.cc, result.id, PASO_WIZARD.carga);
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

  if (!cc || !id) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

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

  if (!cc || !id) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  await cerrarMacrociclo({ id, personaId: persona.id, context: getContext() });

  redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
}

export async function eliminarMacrocicloAction(formData: FormData) {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");

  if (!cc || !id) redirect("/atletas");

  const persona = await getPersona(cc);
  if (!persona) redirect("/atletas");

  await eliminarMacrociclo({
    id,
    personaId: persona.id,
    context: getContext(),
  });

  redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
}

export async function guardarCargaMesocicloAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const cc = getString(formData, "cc");
  const id = getInt(formData, "id");
  const mesocicloId = getInt(formData, "mesocicloId");
  const cargaRaw = getString(formData, "carga");

  if (!cc || !id || !mesocicloId || !cargaRaw) {
    return { success: false, error: "Faltan datos para guardar la carga." };
  }

  const persona = await getPersona(cc);
  if (!persona) {
    return { success: false, error: "Persona no encontrada." };
  }

  let carga: CargaMesocicloInputData | null = null;
  try {
    carga = JSON.parse(cargaRaw) as CargaMesocicloInputData;
  } catch {
    return { success: false, error: "Formato de datos inválido." };
  }

  if (!carga) {
    return { success: false, error: "Formato de datos inválido." };
  }

  try {
    await guardarCargaMesociclo({
      macrocicloId: id,
      personaId: persona.id,
      mesocicloId,
      data: carga,
      context: getContext(),
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible guardar la carga del mesociclo.";

    return { success: false, error: message };
  }
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

  if (!archivo || !(archivo instanceof File)) {
    return { success: false, error: "No se recibió un archivo válido." };
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
