"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateRM, calculateRMForSession, roundToTwo } from "@/lib/rm";
import { calculateEpley } from "@/lib/rm/formulas";
import { estimarRm } from "@/lib/rm/estimacion";
import { actualizarRmVigente } from "@/services/rm.service";
import type { OrigenRmVigente } from "@/lib/rm/vigente";

/**
 * "naclerio" es la grafía correcta (Fernando Naclerio). Las sesiones
 * históricas se guardaron como "nacleiro"; se siguen aceptando al leer, pero
 * nunca se escriben (ADR-31).
 */
type RMMethod = "estimation" | "casas" | "naclerio";

type ResultadoInput = {
  ejercicioId: number;
  repeticiones: number;
  carga: number;
  pesoEquipo: number;
  /** Repeticiones en reserva reportadas por el atleta (ADR-27). */
  rir: number | null;
  casas: number;
  nacleiro: number;
};

type CreateSesionInput = {
  cc: string;
  requestId: string;
  peso: number;
  trainingMonths: number;
  rmMethod: RMMethod;
  estimatedRM: number;
  finalRM: number;
  protocolData: Prisma.InputJsonValue | null;
  ejercicios: ResultadoInput[];
  /** Nombre libre del ejercicio sobre el que se corrió el protocolo directo. */
  protocoloEjercicioNombre?: string | null;
  /** Compatibilidad con llamadas internas anteriores que ya referencian catálogo. */
  protocoloEjercicioId?: number | null;
  /** Repeticiones del mejor intento válido del protocolo. */
  protocoloRepeticiones: number;
  macrocicloId?: number | null;
  returnTo?: string | null;
};

type CreateSesionResult = {
  success: true;
  sesionId: number;
};

function normalizeCC(value: string) {
  return value.trim();
}

function normalizeRequestId(value: string) {
  return value.trim();
}

function parseNonNegativeInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function parseNonNegativeNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function toPositiveInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return null;
  }

  return rounded;
}

function parseRMMethod(
  value: FormDataEntryValue | null,
  trainingMonths: number,
): RMMethod {
  if (trainingMonths < 4) {
    return "estimation";
  }

  if (value === "casas") {
    return "casas";
  }

  // "nacleiro" es la grafía antigua guardada en sesiones históricas.
  if (value === "naclerio" || value === "nacleiro") {
    return "naclerio";
  }

  return "estimation";
}

/** null cuando el atleta no reportó RIR: no es lo mismo que reportar 0. */
function parseRir(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.min(Math.floor(parsed), 10);
}

function parseProtocolData(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

function parseCreateSesionInput(
  formData: FormData,
):
  | { ok: true; data: CreateSesionInput }
  | { ok: false; error: string; cc: string } {
  const cc = normalizeCC(
    typeof formData.get("cc") === "string"
      ? (formData.get("cc") as string)
      : "",
  );
  const requestId = normalizeRequestId(
    typeof formData.get("requestId") === "string"
      ? (formData.get("requestId") as string)
      : "",
  );
  const rawPeso = formData.get("peso");
  const peso = typeof rawPeso === "string" ? Number(rawPeso.trim()) : NaN;
  const trainingMonths = parseNonNegativeInt(formData.get("trainingMonths"));
  const rmMethod = parseRMMethod(formData.get("rmMethod"), trainingMonths);
  const estimatedRM = parseNonNegativeNumber(formData.get("estimatedRM"));
  const finalRM = parseNonNegativeNumber(formData.get("finalRM"));
  const protocolData = parseProtocolData(formData.get("protocolData"));
  const rawMacrocicloId = formData.get("macrocicloId");
  const macrocicloId =
    typeof rawMacrocicloId === "string" && rawMacrocicloId.trim() !== ""
      ? Number(rawMacrocicloId.trim())
      : null;
  const returnTo =
    typeof formData.get("returnTo") === "string"
      ? formData.get("returnTo")?.toString().trim() || null
      : null;

  if (!cc) {
    return { ok: false, error: "Cédula inválida.", cc: "" };
  }

  if (!requestId) {
    return {
      ok: false,
      error: "No fue posible preparar el envío de la sesión.",
      cc,
    };
  }

  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: false, error: "Peso inválido.", cc };
  }

  const resultados: ResultadoInput[] = [];

  for (const rawId of formData.getAll("ejercicioIds")) {
    if (typeof rawId !== "string") {
      continue;
    }

    const ejercicioId = Number(rawId);
    if (!Number.isInteger(ejercicioId) || ejercicioId <= 0) {
      continue;
    }

    resultados.push({
      ejercicioId,
      repeticiones: parseNonNegativeInt(
        formData.get(`repeticiones_${ejercicioId}`),
      ),
      carga: parseNonNegativeNumber(formData.get(`carga_${ejercicioId}`)),
      pesoEquipo: parseNonNegativeNumber(
        formData.get(`pesoEquipo_${ejercicioId}`),
      ),
      rir: parseRir(formData.get(`rir_${ejercicioId}`)),
      casas: parseNonNegativeNumber(formData.get(`casas_${ejercicioId}`)),
      nacleiro: parseNonNegativeNumber(formData.get(`nacleiro_${ejercicioId}`)),
    });
  }

  if (rmMethod === "estimation" && resultados.length === 0) {
    return {
      ok: false,
      error: "No se encontraron ejercicios válidos para registrar.",
      cc,
    };
  }

  const rawProtocoloEjercicioNombre = formData.get("protocoloEjercicioNombre");
  const protocoloEjercicioNombre =
    typeof rawProtocoloEjercicioNombre === "string"
      ? rawProtocoloEjercicioNombre.trim().slice(0, 120)
      : "";
  const protocoloRepeticiones = parseNonNegativeInt(
    formData.get("protocoloRepeticiones"),
  );

  if (rmMethod !== "estimation" && finalRM <= 0) {
    return {
      ok: false,
      error:
        "Registra al menos un levantamiento con peso real y márcalo como completado para cerrar el protocolo.",
      cc,
    };
  }

  // H-01: sin ejercicio, el resultado del protocolo no puede enlazarse con
  // RmVigente y el test quedaría sin efecto sobre la planificación.
  if (
    rmMethod !== "estimation" &&
    !protocoloEjercicioNombre
  ) {
    return {
      ok: false,
      error: "Escribe el ejercicio sobre el que hiciste el protocolo.",
      cc,
    };
  }

  return {
    ok: true,
    data: {
      cc,
      requestId,
      peso,
      trainingMonths,
      rmMethod,
      estimatedRM,
      finalRM,
      protocolData,
      ejercicios: resultados,
      protocoloEjercicioNombre:
        rmMethod === "estimation" ? null : protocoloEjercicioNombre,
      protocoloEjercicioId: null,
      protocoloRepeticiones,
      macrocicloId: macrocicloId && Number.isInteger(macrocicloId) && macrocicloId > 0 ? macrocicloId : null,
      returnTo,
    },
  };
}

function sanitizeInputEjercicios(ejercicios: unknown): ResultadoInput[] {
  if (!Array.isArray(ejercicios)) {
    return [];
  }

  const sanitized: ResultadoInput[] = [];

  for (const item of ejercicios) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rawEjercicioId = (item as { ejercicioId?: unknown }).ejercicioId;
    const ejercicioId = toPositiveInt(
      typeof rawEjercicioId === "number"
        ? rawEjercicioId
        : Number(rawEjercicioId),
    );

    if (!ejercicioId) {
      continue;
    }

    const rawRepeticiones = (item as { repeticiones?: unknown }).repeticiones;
    const rawCarga = (item as { carga?: unknown }).carga;
    const rawPesoEquipo = (item as { pesoEquipo?: unknown }).pesoEquipo;
    const rawRir = (item as { rir?: unknown }).rir;
    const rawCasas = (item as { casas?: unknown }).casas;
    const rawNacleiro = (item as { nacleiro?: unknown }).nacleiro;
    const repeticionesNumber =
      typeof rawRepeticiones === "number"
        ? rawRepeticiones
        : Number(rawRepeticiones);
    const cargaNumber =
      typeof rawCarga === "number" ? rawCarga : Number(rawCarga);
    const pesoEquipoNumber =
      typeof rawPesoEquipo === "number" ? rawPesoEquipo : Number(rawPesoEquipo);
    const casasNumber =
      typeof rawCasas === "number" ? rawCasas : Number(rawCasas);
    const nacleiroNumber =
      typeof rawNacleiro === "number" ? rawNacleiro : Number(rawNacleiro);

    sanitized.push({
      ejercicioId,
      repeticiones: Number.isFinite(repeticionesNumber)
        ? Math.max(0, Math.floor(repeticionesNumber))
        : 0,
      carga: Number.isFinite(cargaNumber) ? Math.max(0, cargaNumber) : 0,
      pesoEquipo: Number.isFinite(pesoEquipoNumber)
        ? Math.max(0, pesoEquipoNumber)
        : 0,
      rir:
        typeof rawRir === "number" && Number.isFinite(rawRir) && rawRir >= 0
          ? Math.min(Math.floor(rawRir), 10)
          : null,
      casas: Number.isFinite(casasNumber) ? Math.max(0, casasNumber) : 0,
      nacleiro: Number.isFinite(nacleiroNumber)
        ? Math.max(0, nacleiroNumber)
        : 0,
    });
  }

  return sanitized;
}

export async function createSesion(
  input: CreateSesionInput,
): Promise<CreateSesionResult> {
  const cc = normalizeCC(typeof input.cc === "string" ? input.cc : "");
  const requestId = normalizeRequestId(
    typeof input.requestId === "string" ? input.requestId : "",
  );
  const sanitizedEjercicios = sanitizeInputEjercicios(input.ejercicios);
  const trainingMonths = Number.isFinite(input.trainingMonths)
    ? Math.max(0, Math.floor(input.trainingMonths))
    : 0;
  const rmMethod = parseRMMethod(input.rmMethod, trainingMonths);

  if (!cc) {
    throw new Error("CC invalido.");
  }

  if (!requestId) {
    throw new Error("No fue posible preparar el envio de la sesion.");
  }

  if (rmMethod === "estimation" && sanitizedEjercicios.length === 0) {
    throw new Error("No se encontraron ejercicios validos para registrar.");
  }

  try {
    const createdSesion = await prisma.$transaction(async (tx) => {
      const persona = await tx.persona.findUnique({
        where: { cc },
        select: {
          id: true,
          masaCorporal: true,
          sexo: true,
        },
      });

      if (!persona) {
        throw new Error("Usuario no encontrado.");
      }

      const ejerciciosDB = await tx.ejercicio.findMany({
        select: {
          id: true,
          porcentajeMasaHombre: true,
          porcentajeMasaMujer: true,
          esDeTiempo: true,
        },
      });
      const ejerciciosSinCarga = new Set(
        ejerciciosDB.filter((e) => e.esDeTiempo).map((e) => e.id),
      );

      const fallbackResults = calculateRMForSession(
        input.peso,
        ejerciciosDB,
        sanitizedEjercicios,
        persona.sexo,
      );
      const fallbackByExercise = new Map(
        fallbackResults.map((item) => [item.ejercicioId, item]),
      );

      const ejerciciosPermitidos = new Set(
        sanitizedEjercicios.map((item) => item.ejercicioId),
      );

      const esProtocoloDirecto = rmMethod !== "estimation";

      // El nombre libre no se publica en el catálogo. Se conserva en una
      // fila técnica inactiva para mantener las relaciones históricas con
      // ResultadoEjercicio, RmVigente y la planificación.
      const ejercicioProtocolo =
        esProtocoloDirecto && input.protocoloEjercicioNombre
          ? (await tx.ejercicio.findFirst({
              where: {
                nombre: input.protocoloEjercicioNombre,
                esEjercicioLibre: true,
              },
            })) ??
            (await tx.ejercicio.create({
              data: {
                nombre: input.protocoloEjercicioNombre,
                porcentajeMasaHombre: 0,
                porcentajeMasaMujer: 0,
                patron: "accesorio",
                musculoPrimario: "",
                equipamiento: "otro",
                incrementoMinimoKg: 2.5,
                admitePorcentajeRm: true,
                esDeTiempo: false,
                esUnilateral: false,
                enBateriaEvaluacion: false,
                activo: false,
                esEjercicioLibre: true,
              },
            }))
          : esProtocoloDirecto && input.protocoloEjercicioId
            ? await tx.ejercicio.findUnique({
                where: { id: input.protocoloEjercicioId },
              })
            : null;

      const resultadosEstimacion = sanitizedEjercicios
        .filter((item) => ejerciciosPermitidos.has(item.ejercicioId))
        .map((item) => {
          const fallback = fallbackByExercise.get(item.ejercicioId);
          const withoutLoad = ejerciciosSinCarga.has(item.ejercicioId);
          const pesoLevantado = item.carga > 0 ? item.carga : fallback?.carga ?? 0;
          const pesoEquipo = withoutLoad ? 0 : item.pesoEquipo;
          const carga = withoutLoad ? 0 : pesoLevantado + pesoEquipo;
          const formula = calculateRM(carga, item.repeticiones, persona.sexo);
          // C-03/M4: estimador puntual único con confianza explícita.
          // withoutLoad (esDeTiempo)
          // no produce un RM utilizable (D-17/esDeTiempo).
          //
          // ADR-27: el RIR reportado entra en la estimación. Una serie con
          // repeticiones en reserva no es una serie al fallo, y sin corregirlo
          // Epley subestima el 1RM de forma sistemática.
          const estimacion = withoutLoad
            ? null
            : estimarRm(carga, item.repeticiones, {
                sexo: persona.sexo,
                rirReportado: item.rir,
              });

          return {
            ejercicioId: item.ejercicioId,
            repeticiones: item.repeticiones,
            carga: roundToTwo(carga),
            pesoEquipo: roundToTwo(pesoEquipo),
            epley: roundToTwo(formula.epley),
            brzycki: roundToTwo(formula.brzycki),
            lombardi: roundToTwo(formula.lombardi),
            lander: roundToTwo(formula.lander),
            oconnor: roundToTwo(formula.oconnor),
            mayhew: roundToTwo(formula.mayhew),
            wathen: roundToTwo(formula.wathen),
            baechle: roundToTwo(formula.baechle),
            casas: 0,
            nacleiro: 0,
            rm1Estimado: estimacion ? roundToTwo(estimacion.valor) : null,
            confianza: estimacion?.confianza ?? null,
            formulaPrimaria: estimacion ? "epley" : null,
            fueraDeRango: estimacion?.fueraDeRango ?? false,
            rirReportado: item.rir,
          };
        });

      // H-01/ADR-30 — un protocolo directo también produce un
      // `ResultadoEjercicio`. Antes no lo hacía: el bucle que abre
      // `RmVigente` recorre los resultados de la sesión, así que el RM medido
      // por el método más preciso moría en `Sesion.finalRM` y la
      // planificación seguía usando la estimación.
      const resultadoProtocolo = (() => {
        if (!esProtocoloDirecto || !ejercicioProtocolo) {
          return null;
        }

        const cargaMedida = input.finalRM;
        if (!(cargaMedida > 0)) {
          throw new Error(
            "El protocolo no registro ningun levantamiento valido.",
          );
        }

        // El mejor intento suele ser de 1 repetición: entonces la carga *es*
        // el 1RM, sin fórmula de por medio. Si se completaron 2 o 3, se
        // estima desde ahí (sigue siendo una medida directa de esa carga).
        const repeticiones = Math.max(
          1,
          Math.min(input.protocoloRepeticiones || 1, 5),
        );
        const formula = calculateRM(cargaMedida, repeticiones, persona.sexo);
        const rmMedido =
          repeticiones <= 1
            ? cargaMedida
            : calculateEpley(cargaMedida, repeticiones);

        return {
          ejercicioId: ejercicioProtocolo.id,
          repeticiones,
          carga: roundToTwo(cargaMedida),
          pesoEquipo: 0,
          epley: roundToTwo(formula.epley),
          brzycki: roundToTwo(formula.brzycki),
          lombardi: roundToTwo(formula.lombardi),
          lander: roundToTwo(formula.lander),
          oconnor: roundToTwo(formula.oconnor),
          mayhew: roundToTwo(formula.mayhew),
          wathen: roundToTwo(formula.wathen),
          baechle: roundToTwo(formula.baechle),
          casas: roundToTwo(rmMethod === "casas" ? rmMedido : 0),
          nacleiro: roundToTwo(rmMethod === "naclerio" ? rmMedido : 0),
          rm1Estimado: roundToTwo(rmMedido),
          // Un peso levantado y verificado es el dato de mayor calidad que
          // puede entrar al sistema.
          confianza: "alta",
          formulaPrimaria: repeticiones <= 1 ? "medicion_directa" : "epley",
          fueraDeRango: false,
          rirReportado: 0,
        };
      })();

      const resultadosData = esProtocoloDirecto
        ? resultadoProtocolo
          ? [resultadoProtocolo]
          : []
        : resultadosEstimacion;

      if (resultadosData.length === 0) {
        throw new Error(
          "No se pudieron preparar resultados validos para la sesion.",
        );
      }

      // D-15: guardar una sesión no debe borrar en silencio el nivelOverride
      // que el entrenador fijó a mano.
      //
      // ADR-36/D-14: tampoco escribe ya `faseEntrenamiento`/`faseInicioAt`.
      // Fijar la fase a "resistencia" en la primera sesión era el último
      // resto de un sistema de progresión paralelo al macrociclo: nada la
      // hacía avanzar después, así que todo atleta quedaba en "Resistencia"
      // para siempre. La fase se deriva ahora del mesociclo activo.
      await tx.persona.update({
        where: { id: persona.id },
        data: {
          masaCorporal: input.peso,
        },
      });

      // D-01: Sesion.estimatedRM/finalRM ya no se calculan como el máximo
      // entre ejercicios distintos (ese escalar no tiene sentido físico: la
      // prensa de pierna dominaría siempre sobre press banca). El RM de cada
      // ejercicio ya vive en su propio ResultadoEjercicio. Solo se persiste
      // un valor a nivel de sesión cuando es inequívoco: un único ejercicio
      // evaluado, o un protocolo Casas/Nacleiro sobre un ejercicio de
      // referencia (sanitizedEjercicios vacío en ese caso).
      const unicoResultadoEstimacion =
        !esProtocoloDirecto && resultadosEstimacion.length === 1
          ? resultadosEstimacion[0]
          : null;

      // Para un protocolo directo, `estimatedRM` guarda el RM de referencia
      // con el que se armaron los pesos y `finalRM` el que realmente se
      // levantó: la diferencia entre ambos es la que dice si la referencia
      // estaba bien calibrada.
      const estimatedRM = esProtocoloDirecto
        ? input.estimatedRM
        : (unicoResultadoEstimacion?.rm1Estimado ?? 0);
      const finalRM = esProtocoloDirecto
        ? (resultadoProtocolo?.rm1Estimado ?? 0)
        : (unicoResultadoEstimacion?.rm1Estimado ?? 0);

      const creada = await tx.sesion.create({
        data: {
          personaId: persona.id,
          peso: input.peso,
          requestId,
          trainingMonths,
          rmMethod,
          estimatedRM: estimatedRM > 0 ? roundToTwo(estimatedRM) : null,
          finalRM: finalRM > 0 ? roundToTwo(finalRM) : null,
          protocolData: input.protocolData ?? Prisma.JsonNull,
          createdAt: new Date(),
          resultados: {
            create: resultadosData,
          },
        },
        select: {
          id: true,
          createdAt: true,
          resultados: {
            select: {
              id: true,
              ejercicioId: true,
              rm1Estimado: true,
              confianza: true,
              fueraDeRango: true,
            },
          },
        },
      });

      // M4/TASK-022: cada resultado con una estimación utilizable pasa a
      // ser el RM vigente de ese ejercicio (D-01: nunca uno global). Un
      // resultado fuera de rango no reemplaza el vigente (D-04/AC-06).
      //
      // H-01: el origen ya no está fijado a "estimacion". Un protocolo Casas
      // o Naclerio produce un RM *medido*, y esa distinción es la que permite
      // después saber de qué calidad es el dato que alimenta el plan.
      const origenRm: OrigenRmVigente = esProtocoloDirecto
        ? "test_directo"
        : "estimacion";

      for (const resultado of creada.resultados) {
        if (
          resultado.rm1Estimado === null ||
          resultado.rm1Estimado <= 0 ||
          resultado.fueraDeRango ||
          !(resultado.confianza === "alta" || resultado.confianza === "media" || resultado.confianza === "baja")
        ) {
          continue;
        }

        await actualizarRmVigente(tx, {
          personaId: persona.id,
          ejercicioId: resultado.ejercicioId,
          valorKg: resultado.rm1Estimado,
          origen: origenRm,
          confianza: resultado.confianza,
          resultadoRmId: resultado.id,
          fecha: creada.createdAt,
        });
      }

      return { id: creada.id };
    });

    return {
      success: true,
      sesionId: createdSesion.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingSesion = await prisma.sesion.findUnique({
        where: {
          requestId,
        },
        select: {
          id: true,
        },
      });

      if (existingSesion) {
        return {
          success: true,
          sesionId: existingSesion.id,
        };
      }

      throw new Error("No fue posible guardar la sesion. Intenta nuevamente.");
    }

    if (error instanceof Error) {
      if (
        error.message === "CC invalido." ||
        error.message ===
          "No se encontraron ejercicios validos para registrar." ||
        error.message === "Usuario no encontrado." ||
        error.message ===
          "No se pudieron preparar resultados validos para la sesion."
      ) {
        throw error;
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[createSesion Prisma Error]", error);
      throw new Error("No fue posible guardar la sesion. Intenta nuevamente.");
    }

    console.error("[createSesion Unexpected Error]", error);
    throw new Error("Error inesperado al crear la sesion.");
  }
}

export async function createSesionAction(formData: FormData) {
  const parsed = parseCreateSesionInput(formData);

  if (!parsed.ok) {
    const fallbackCC = parsed.cc ? `?cc=${encodeURIComponent(parsed.cc)}` : "";
    const separator = fallbackCC ? "&" : "?";
    redirect(
      `/nueva-sesion${fallbackCC}${separator}error=${encodeURIComponent(parsed.error)}`,
    );
  }

  let saveError: string | null = null;
  let result: CreateSesionResult | null = null;

  try {
    result = await createSesion(parsed.data);
  } catch (error) {
    saveError =
      error instanceof Error
        ? error.message
        : "No fue posible crear la sesion. Intenta nuevamente.";
  }

  if (saveError || !result) {
    const errorMessage =
      saveError ?? "No fue posible crear la sesión. Intenta nuevamente.";
    redirect(
      `/nueva-sesion?cc=${encodeURIComponent(parsed.data.cc)}&error=${encodeURIComponent(errorMessage)}`,
    );
  }

  if (
    parsed.data.returnTo === "macrociclo" &&
    parsed.data.macrocicloId &&
    result?.sesionId
  ) {
    redirect(
      `/macrociclo/${parsed.data.macrocicloId}/editar?cc=${encodeURIComponent(parsed.data.cc)}&paso=2`,
    );
  }

  redirect(
    `/dashboard?cc=${encodeURIComponent(parsed.data.cc)}&saved=1&sesionId=${result.sesionId}`,
  );
}

export async function deleteSesionAction(formData: FormData) {
  const rawSesionId = formData.get("sesionId");
  const rawCC = formData.get("cc");
  const sesionId = typeof rawSesionId === "string" ? Number(rawSesionId) : NaN;
  const cc = typeof rawCC === "string" ? normalizeCC(rawCC) : "";

  if (!cc) {
    redirect("/atletas");
  }

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    redirect(`/dashboard?cc=${encodeURIComponent(cc)}&deleteError=1`);
  }

  await prisma.sesion.deleteMany({
    where: {
      id: sesionId,
      persona: {
        cc,
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?cc=${encodeURIComponent(cc)}&deleted=1`);
}
