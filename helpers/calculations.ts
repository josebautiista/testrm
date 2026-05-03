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
