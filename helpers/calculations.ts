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

  return {
    label: "Obesidad",
    color: "rojo",
  };
}

export function calculateICC(cintura: number, cadera: number): number {
  return safeDivide(cintura, cadera);
}

export function getICCClassification(icc: number): HealthClassification {
  if (!Number.isFinite(icc) || icc <= 0) {
    return {
      label: "Sin datos",
      color: "amarillo",
    };
  }

  if (icc < 0.85) {
    return {
      label: "Riesgo bajo",
      color: "verde",
    };
  }

  if (icc <= 0.9) {
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

export function getPorcentajeMasa(
  persona: Pick<PersonaMetrics, "sexo">,
  ejercicio: EjercicioMasa,
): number {
  const sexo = normalizeSexo(persona.sexo) ?? "masculino";

  return sexo === "masculino"
    ? ejercicio.porcentajeMasaHombre
    : ejercicio.porcentajeMasaMujer;
}
