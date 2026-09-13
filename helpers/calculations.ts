import { normalizeSexo } from "@/helpers/validators";

type PersonaMetrics = {
  masaCorporal: number;
  talla: number;
  cintura?: number;
  cadera?: number;
  sexo: string;
};

type EjercicioMasa = {
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
};

function safeDivide(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  return numerator / denominator;
}

export type RiskColor = "verde" | "amarillo" | "rojo";

export type HealthClassification = {
  label: string;
  color: RiskColor;
};

export type BMIInterpretation = HealthClassification & {
  message: string;
};

export function calculateIMC(
  persona: Pick<PersonaMetrics, "masaCorporal" | "talla">,
): number {
  return safeDivide(persona.masaCorporal, persona.talla ** 2);
}

export function getIMCClassification(imc: number): HealthClassification {
  if (!Number.isFinite(imc) || imc <= 0) {
    return {
      label: "Sin datos",
      color: "amarillo",
    };
  }

  if (imc < 18.5) {
    return {
      label: "Bajo peso",
      color: "amarillo",
    };
  }

  if (imc < 25) {
    return {
      label: "Normal",
      color: "verde",
    };
  }

  if (imc < 30) {
    return {
      label: "Sobrepeso",
      color: "amarillo",
    };
  }

  if (imc < 35) {
    return {
      label: "Obesidad grado I",
      color: "rojo",
    };
  }

  if (imc < 40) {
    return {
      label: "Obesidad grado II",
      color: "rojo",
    };
  }

  return {
    label: "Obesidad grado III",
    color: "rojo",
  };
}

export function getBMIInterpretation(bmi: number): BMIInterpretation {
  const classification = getIMCClassification(bmi);

  if (!Number.isFinite(bmi) || bmi <= 0) {
    return {
      ...classification,
      message: "Ingresa tu peso y estatura para calcular este valor.",
    };
  }

  if (bmi < 18.5) {
    return {
      ...classification,
      message:
        "Tu peso está por debajo de lo recomendado. Podrías beneficiarte de mejorar tu alimentación",
    };
  }

  if (bmi < 25) {
    return {
      ...classification,
      message: "Tu peso está dentro del rango saludable",
    };
  }

  if (bmi < 30) {
    return {
      ...classification,
      message:
        "Estás por encima del rango recomendado. Ajustes en alimentación y ejercicio pueden ayudarte",
    };
  }

  return {
    ...classification,
    message:
      "Este valor puede estar asociado a riesgos para la salud. Es recomendable hacer cambios progresivos",
  };
}

export function calculateICC(cintura: number, cadera: number): number {
  return safeDivide(cintura, cadera);
}

type SexoHealth = "masculino" | "femenino";

function normalizeHealthSexo(sexo?: string | null): SexoHealth | null {
  if (!sexo) {
    return null;
  }

  const normalized = sexo.trim().toLowerCase();

  if (
    normalized === "masculino" ||
    normalized === "hombre" ||
    normalized === "m"
  ) {
    return "masculino";
  }

  if (
    normalized === "femenino" ||
    normalized === "mujer" ||
    normalized === "f"
  ) {
    return "femenino";
  }

  return null;
}

export function getICCClassification(
  icc: number,
  sexo?: string | null,
): HealthClassification {
  if (!Number.isFinite(icc) || icc <= 0) {
    return {
      label: "Sin datos",
      color: "amarillo",
    };
  }

  const normalizedSexo = normalizeHealthSexo(sexo);

  if (normalizedSexo === "femenino") {
    if (icc < 0.8) {
      return {
        label: "Riesgo bajo",
        color: "verde",
      };
    }

    if (icc < 0.85) {
      return {
        label: "Riesgo moderado",
        color: "amarillo",
      };
    }

    return {
      label: "Riesgo alto",
      color: "rojo",
    };
  }

  if (icc < 0.9) {
    return {
      label: "Riesgo bajo",
      color: "verde",
    };
  }

  if (icc < 1) {
    return {
      label: "Riesgo moderado",
      color: "amarillo",
    };
  }

  return {
    label: "Riesgo alto",
    color: "rojo",
  };
}

export function getWaistCircumferenceClassification(
  cintura: number | null | undefined,
  sexo?: string | null,
): HealthClassification {
  if (typeof cintura !== "number" || !Number.isFinite(cintura) || cintura <= 0) {
    return {
      label: "Sin datos",
      color: "amarillo",
    };
  }

  const normalizedSexo = normalizeHealthSexo(sexo);
  const highRiskThreshold = normalizedSexo === "femenino" ? 88 : 102;

  if (cintura >= highRiskThreshold) {
    return {
      label: "Riesgo alto",
      color: "rojo",
    };
  }

  return {
    label: "Dentro del rango esperado",
    color: "verde",
  };
}

// ---------------------------------------------------------------------------
// VO2max: clasificación por edad y sexo
// ---------------------------------------------------------------------------
//
// Tabla de referencia de uso extendido en la industria del fitness (p. ej.
// reproducida por ACE, Topend Sports y certificaciones de entrenador
// personal), derivada de normas históricas de varias fuentes sin un único
// estudio primario citable. Se presenta como referencia orientativa, igual
// que el índice de fuerza interno (F-12, docs/PLAN-MAESTRO.md) — no como un
// estándar clínico. Umbrales en ml/kg/min, límite inferior de cada categoría.
type Vo2maxCategoriaLabel =
  | "Muy pobre"
  | "Pobre"
  | "Debajo del promedio"
  | "Promedio"
  | "Sobre el promedio"
  | "Bueno"
  | "Excelente";

const VO2MAX_CATEGORIAS: Vo2maxCategoriaLabel[] = [
  "Muy pobre",
  "Pobre",
  "Debajo del promedio",
  "Promedio",
  "Sobre el promedio",
  "Bueno",
  "Excelente",
];

// Cada tupla: [edadMaxima, umbrales ascendentes de las 6 fronteras entre
// las 7 categorías]. La última fila (Infinity) cubre 65+.
const VO2MAX_UMBRALES_HOMBRE: [number, number[]][] = [
  [25, [30, 37, 42, 47, 52, 60]],
  [35, [30, 35, 40, 43, 49, 56]],
  [45, [26, 31, 35, 39, 43, 51]],
  [55, [25, 29, 32, 36, 39, 45]],
  [65, [22, 26, 30, 32, 36, 41]],
  [Infinity, [20, 22, 26, 29, 33, 37]],
];

const VO2MAX_UMBRALES_MUJER: [number, number[]][] = [
  [25, [28, 33, 38, 42, 47, 56]],
  [35, [26, 31, 35, 39, 45, 52]],
  [45, [22, 27, 31, 34, 38, 45]],
  [55, [20, 25, 28, 31, 34, 40]],
  [65, [18, 22, 25, 28, 32, 37]],
  [Infinity, [17, 19, 22, 25, 28, 32]],
];

function normalizarSexoVo2max(sexo?: string | null): "hombre" | "mujer" | null {
  const normalizado = normalizeHealthSexo(sexo);
  if (normalizado === "masculino") return "hombre";
  if (normalizado === "femenino") return "mujer";
  return null;
}

function colorParaCategoriaVo2max(categoria: Vo2maxCategoriaLabel): RiskColor {
  if (categoria === "Muy pobre" || categoria === "Pobre") return "rojo";
  if (categoria === "Debajo del promedio" || categoria === "Promedio") {
    return "amarillo";
  }
  return "verde";
}

/**
 * Clasifica un VO2max (ml/kg/min) contra la tabla de normas por edad y sexo.
 * Requiere edad y sexo reconocibles; sin ellos no hay tabla contra la cual
 * comparar y se devuelve "Sin datos" en vez de adivinar.
 */
export function getVO2MaxClassification(
  vo2max: number,
  edad?: number | null,
  sexo?: string | null,
): HealthClassification {
  const sinDatos: HealthClassification = { label: "Sin datos", color: "amarillo" };

  if (!Number.isFinite(vo2max) || vo2max <= 0) return sinDatos;
  if (typeof edad !== "number" || !Number.isFinite(edad) || edad <= 0) {
    return sinDatos;
  }

  const sexoNormalizado = normalizarSexoVo2max(sexo);
  if (!sexoNormalizado) return sinDatos;

  const tabla =
    sexoNormalizado === "hombre" ? VO2MAX_UMBRALES_HOMBRE : VO2MAX_UMBRALES_MUJER;
  const fila = tabla.find(([edadMaxima]) => edad <= edadMaxima) ?? tabla[tabla.length - 1];
  const umbrales = fila[1];

  let indiceCategoria = 0;
  for (const umbral of umbrales) {
    if (vo2max >= umbral) indiceCategoria += 1;
  }

  const categoria = VO2MAX_CATEGORIAS[indiceCategoria];
  return { label: categoria, color: colorParaCategoriaVo2max(categoria) };
}

export function getPorcentajeMasa(
  persona: Pick<PersonaMetrics, "sexo">,
  ejercicio: EjercicioMasa,
): number {
  const sexo = normalizeSexo(persona.sexo) ?? "masculino";

  return sexo === "masculino"
    ? ejercicio.porcentajeMasaHombre
    : ejercicio.porcentajeMasaMujer;
}

export type StrengthLevel = "Bajo" | "Promedio" | "Alto";

// Determina un indicador simple de fuerza relativo al peso corporal.
// Entrada: 1RM (kg) y masa corporal (kg). Se retorna: Bajo/Promedio/Alto.
export function getStrengthLevel(
  oneRM: number,
  masaCorporal: number,
): StrengthLevel {
  if (
    !Number.isFinite(oneRM) ||
    !Number.isFinite(masaCorporal) ||
    masaCorporal <= 0
  ) {
    return "Bajo";
  }

  const ratio = oneRM / masaCorporal;

  // Umbrales simples: <0.6 Bajo, 0.6-1.0 Promedio, >1.0 Alto
  if (ratio <= 0.6) return "Bajo";
  if (ratio <= 1.0) return "Promedio";
  return "Alto";
}
