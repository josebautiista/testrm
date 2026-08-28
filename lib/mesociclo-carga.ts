export type DireccionCarga = {
  id: string;
  nombre: string;
};

export type SemanaCargaInfo = {
  numeroSemana: number;
  frecuencia: number;
};

/** Valor que puede tener un input numérico: número o vacío. */
export type PorcentajeInput = number | "";

/** Datos sanitizados (persistidos en BD): todos los valores son números. */
export type CargaMesocicloData = {
  tiempoSesionMin: number;
  direcciones: DireccionCarga[];
  /** direccionId → porcentaje del volumen total (debe sumar 100) */
  volumen: Record<string, number>;
  /** direccionId → numeroSemana → porcentaje (suma 100 por dirección) */
  microciclos: Record<string, Record<string, number>>;
  /** direccionId → numeroSemana → sesionIdx → porcentaje (suma 100 por semana) */
  sesiones: Record<string, Record<string, Record<string, number>>>;
};

/** Datos tal como los maneja el editor: permite campos vacíos mientras se edita. */
export type CargaMesocicloInputData = {
  tiempoSesionMin: PorcentajeInput;
  direcciones: DireccionCarga[];
  volumen: Record<string, PorcentajeInput>;
  microciclos: Record<string, Record<string, PorcentajeInput>>;
  sesiones: Record<string, Record<string, Record<string, PorcentajeInput>>>;
};

/**
 * M-01/ADR-41 · Las direcciones por defecto eran siempre las cuatro del
 * modelo de deportes de equipo (físico, **táctico**, técnico, psicológico).
 * A quien entrena por salud "entrenamiento táctico" no le dice nada, y a un
 * powerlifter tampoco: el paso de carga le pedía repartir porcentajes entre
 * categorías que no aplican.
 *
 * Se siguen pudiendo añadir o quitar direcciones a mano; esto solo cambia con
 * cuáles se arranca.
 */
export const DIRECCIONES_POR_DEFECTO: DireccionCarga[] = [
  { id: "fisico", nombre: "Entrenamiento físico" },
  { id: "tactico", nombre: "Entrenamiento táctico" },
  { id: "tecnico", nombre: "Entrenamiento técnico" },
  { id: "psicologico", nombre: "Entrenamiento psicológico" },
];

const DIRECCION_FISICO: DireccionCarga = {
  id: "fisico",
  nombre: "Entrenamiento físico",
};
const DIRECCION_TECNICO: DireccionCarga = {
  id: "tecnico",
  nombre: "Entrenamiento técnico",
};
const DIRECCION_TACTICO: DireccionCarga = {
  id: "tactico",
  nombre: "Entrenamiento táctico",
};
const DIRECCION_PSICOLOGICO: DireccionCarga = {
  id: "psicologico",
  nombre: "Entrenamiento psicológico",
};

/**
 * Direcciones con las que arranca el editor según el perfil deportivo.
 *
 * - Sin competencia: solo físico y técnico. No hay rival contra quien plantear
 *   una táctica, y el trabajo psicológico específico de competir no aplica.
 * - Mixto o intermitente (deportes de equipo y de oposición): las cuatro.
 * - Fuerza-potencia y técnico-estético: sin táctica, que en estas disciplinas
 *   no es una dirección de entrenamiento separada.
 */
export function direccionesPorDefectoPara(perfil: {
  capacidad: string;
  calendario: string;
}): DireccionCarga[] {
  if (perfil.calendario === "sin_competencia") {
    return [DIRECCION_FISICO, DIRECCION_TECNICO];
  }

  if (perfil.capacidad === "mixto_intermitente") {
    return [
      DIRECCION_FISICO,
      DIRECCION_TACTICO,
      DIRECCION_TECNICO,
      DIRECCION_PSICOLOGICO,
    ];
  }

  return [DIRECCION_FISICO, DIRECCION_TECNICO, DIRECCION_PSICOLOGICO];
}

const TOLERANCIA = 0.01;

export function aNumero(value: PorcentajeInput): number {
  if (value === "" || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export function esSuma100(valores: PorcentajeInput[]): boolean {
  const suma = valores.reduce<number>((acc, v) => acc + aNumero(v), 0);
  return Math.abs(suma - 100) <= TOLERANCIA;
}

export function sumaPorcentajes(valores: PorcentajeInput[]): number {
  return valores.reduce<number>((acc, v) => acc + aNumero(v), 0);
}

/** Volumen total del mesociclo en minutos: tiempoSesion × total de sesiones (frecuencias). */
export function calcularMinutosTotales(
  tiempoSesionMin: PorcentajeInput,
  semanas: SemanaCargaInfo[],
): number {
  const totalSesiones = semanas.reduce(
    (acc, semana) => acc + Math.max(0, semana.frecuencia),
    0,
  );
  return aNumero(tiempoSesionMin) * totalSesiones;
}

/** Nivel 1 del Excel: minutos por dirección = %volumen × total. */
export function calcularMinutosPorDireccion(
  data: CargaMesocicloInputData,
  semanas: SemanaCargaInfo[],
): Record<string, number> {
  const total = calcularMinutosTotales(data.tiempoSesionMin, semanas);
  const resultado: Record<string, number> = {};
  for (const direccion of data.direcciones) {
    const pct = aNumero(data.volumen[direccion.id]);
    resultado[direccion.id] = (pct * total) / 100;
  }
  return resultado;
}

/** Nivel 2 del Excel: minutos por dirección y semana = %micro × minutosDirección. */
export function calcularMinutosPorSemana(
  data: CargaMesocicloInputData,
  semanas: SemanaCargaInfo[],
): Record<string, Record<string, number>> {
  const porDireccion = calcularMinutosPorDireccion(data, semanas);
  const resultado: Record<string, Record<string, number>> = {};
  for (const direccion of data.direcciones) {
    const porSemana: Record<string, number> = {};
    for (const semana of semanas) {
      const pct = aNumero(
        data.microciclos[direccion.id]?.[String(semana.numeroSemana)],
      );
      porSemana[String(semana.numeroSemana)] =
        (pct * porDireccion[direccion.id]) / 100;
    }
    resultado[direccion.id] = porSemana;
  }
  return resultado;
}

/** Nivel 3 del Excel: minutos por sesión = %sesión × minutosSemana. */
export function calcularMinutosPorSesion(
  data: CargaMesocicloInputData,
  semanas: SemanaCargaInfo[],
): Record<string, Record<string, Record<string, number>>> {
  const porSemana = calcularMinutosPorSemana(data, semanas);
  const resultado: Record<string, Record<string, Record<string, number>>> = {};
  for (const direccion of data.direcciones) {
    const direccionId = direccion.id;
    const porSemanaDireccion: Record<string, Record<string, number>> = {};
    for (const semana of semanas) {
      const semanaKey = String(semana.numeroSemana);
      const porSesion: Record<string, number> = {};
      for (let idx = 0; idx < Math.max(0, semana.frecuencia); idx++) {
        const pct = aNumero(
          data.sesiones[direccionId]?.[semanaKey]?.[String(idx)],
        );
        porSesion[String(idx)] =
          (pct * porSemana[direccionId][semanaKey]) / 100;
      }
      porSemanaDireccion[semanaKey] = porSesion;
    }
    resultado[direccionId] = porSemanaDireccion;
  }
  return resultado;
}

/** Reparto inicial del volumen por dirección, normalizado a 100. */
const PESO_INICIAL_DIRECCION: Record<string, number> = {
  fisico: 40,
  tactico: 30,
  tecnico: 10,
  psicologico: 20,
};

export function crearCargaInicial(
  semanas: SemanaCargaInfo[],
  /** M-01: sin perfil se conserva el comportamiento anterior (las cuatro). */
  perfil?: { capacidad: string; calendario: string },
): CargaMesocicloInputData {
  const direcciones = perfil
    ? direccionesPorDefectoPara(perfil)
    : [...DIRECCIONES_POR_DEFECTO];

  // El reparto se renormaliza a 100 sobre las direcciones que quedan: si se
  // arranca solo con físico y técnico, sus pesos no pueden sumar 50.
  const totalPesos = direcciones.reduce(
    (suma, direccion) => suma + (PESO_INICIAL_DIRECCION[direccion.id] ?? 0),
    0,
  );
  const volumen: Record<string, PorcentajeInput> = {};
  for (const direccion of direcciones) {
    const peso = PESO_INICIAL_DIRECCION[direccion.id] ?? 0;
    volumen[direccion.id] =
      totalPesos > 0 ? Math.round((peso / totalPesos) * 100) : 0;
  }

  const microciclos: Record<string, Record<string, PorcentajeInput>> = {};
  const sesiones: Record<
    string,
    Record<string, Record<string, PorcentajeInput>>
  > = {};

  const pctSemana = semanas.length > 0 ? 100 / semanas.length : 0;

  for (const direccion of direcciones) {
    const porSemana: Record<string, PorcentajeInput> = {};
    const sesionesPorSemana: Record<string, Record<string, PorcentajeInput>> =
      {};
    for (const semana of semanas) {
      porSemana[String(semana.numeroSemana)] = pctSemana;
      const frecuencia = Math.max(0, semana.frecuencia);
      const pctSesion = frecuencia > 0 ? 100 / frecuencia : 0;
      const porSesion: Record<string, PorcentajeInput> = {};
      for (let idx = 0; idx < frecuencia; idx++) {
        porSesion[String(idx)] = pctSesion;
      }
      sesionesPorSemana[String(semana.numeroSemana)] = porSesion;
    }
    microciclos[direccion.id] = porSemana;
    sesiones[direccion.id] = sesionesPorSemana;
  }

  return {
    tiempoSesionMin: 120,
    direcciones,
    volumen,
    microciclos,
    sesiones,
  };
}

function esNumeroValido(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sanitizarPorcentaje(value: PorcentajeInput): number {
  return value === "" ? 0 : value;
}

export type CargaValidationResult =
  | { ok: true; data: CargaMesocicloData }
  | { ok: false; error: string };

export function validarCargaMesociclo(
  input: unknown,
  semanas: SemanaCargaInfo[],
): CargaValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Formato de datos inválido." };
  }

  const data = input as CargaMesocicloInputData;

  if (
    data.tiempoSesionMin === "" ||
    !esNumeroValido(data.tiempoSesionMin) ||
    data.tiempoSesionMin <= 0 ||
    data.tiempoSesionMin > 1440
  ) {
    return {
      ok: false,
      error: "El tiempo de sesión debe estar entre 1 y 1440 minutos.",
    };
  }

  if (!Array.isArray(data.direcciones) || data.direcciones.length === 0) {
    return { ok: false, error: "Debes definir al menos una dirección." };
  }

  const ids = new Set<string>();
  for (const direccion of data.direcciones) {
    if (
      !direccion ||
      typeof direccion.id !== "string" ||
      !direccion.id.trim() ||
      typeof direccion.nombre !== "string" ||
      !direccion.nombre.trim()
    ) {
      return {
        ok: false,
        error: "Cada dirección debe tener identificador y nombre.",
      };
    }
    if (ids.has(direccion.id)) {
      return { ok: false, error: "Hay direcciones duplicadas." };
    }
    ids.add(direccion.id);
  }

  const volumenValores = data.direcciones.map((d) => data.volumen?.[d.id] ?? 0);
  if (!volumenValores.every(esNumeroValido)) {
    return {
      ok: false,
      error: "Los porcentajes de volumen deben ser números positivos.",
    };
  }
  if (!esSuma100(volumenValores)) {
    return {
      ok: false,
      error: `La distribución de volumen debe sumar 100% (actual: ${sumaPorcentajes(volumenValores)}%).`,
    };
  }

  const volumenSanitizado: Record<string, number> = {};
  for (const direccion of data.direcciones) {
    volumenSanitizado[direccion.id] = sanitizarPorcentaje(
      data.volumen[direccion.id],
    );
  }

  const microciclosSanitizados: Record<string, Record<string, number>> = {};
  const sesionesSanitizadas: Record<
    string,
    Record<string, Record<string, number>>
  > = {};

  for (const direccion of data.direcciones) {
    const porSemana = data.microciclos?.[direccion.id] ?? {};
    const valores = semanas.map((s) => porSemana[String(s.numeroSemana)] ?? 0);
    if (!valores.every(esNumeroValido)) {
      return {
        ok: false,
        error: `Los porcentajes por microciclo de "${direccion.nombre}" deben ser números positivos.`,
      };
    }
    if (!esSuma100(valores)) {
      return {
        ok: false,
        error: `La distribución por microciclos de "${direccion.nombre}" debe sumar 100% (actual: ${sumaPorcentajes(valores)}%).`,
      };
    }

    microciclosSanitizados[direccion.id] = {};
    sesionesSanitizadas[direccion.id] = {};

    for (const semana of semanas) {
      microciclosSanitizados[direccion.id][String(semana.numeroSemana)] =
        sanitizarPorcentaje(
          data.microciclos[direccion.id]?.[String(semana.numeroSemana)],
        );

      const porSesion =
        data.sesiones?.[direccion.id]?.[String(semana.numeroSemana)] ?? {};
      const valoresSesion: PorcentajeInput[] = [];
      for (let idx = 0; idx < Math.max(0, semana.frecuencia); idx++) {
        valoresSesion.push(porSesion[String(idx)] ?? 0);
      }
      if (!valoresSesion.every(esNumeroValido)) {
        return {
          ok: false,
          error: `Los porcentajes por sesión de "${direccion.nombre}" en la semana ${semana.numeroSemana} deben ser números positivos.`,
        };
      }
      if (valoresSesion.length > 0 && !esSuma100(valoresSesion)) {
        return {
          ok: false,
          error: `Las sesiones de "${direccion.nombre}" en la semana ${semana.numeroSemana} deben sumar 100% (actual: ${sumaPorcentajes(valoresSesion)}%).`,
        };
      }

      sesionesSanitizadas[direccion.id][String(semana.numeroSemana)] = {};
      for (let idx = 0; idx < Math.max(0, semana.frecuencia); idx++) {
        sesionesSanitizadas[direccion.id][String(semana.numeroSemana)][
          String(idx)
        ] = sanitizarPorcentaje(
          data.sesiones[direccion.id]?.[String(semana.numeroSemana)]?.[
            String(idx)
          ],
        );
      }
    }
  }

  return {
    ok: true,
    data: {
      tiempoSesionMin: data.tiempoSesionMin,
      direcciones: data.direcciones,
      volumen: volumenSanitizado,
      microciclos: microciclosSanitizados,
      sesiones: sesionesSanitizadas,
    },
  };
}
