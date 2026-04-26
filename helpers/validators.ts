export type Sexo = "masculino" | "femenino";

export const CIRCUMFERENCE_MIN_CM = 50;
export const CIRCUMFERENCE_MAX_CM = 200;

export function normalizeSexo(value: string): Sexo | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "masculino" || normalized === "femenino") {
    return normalized;
  }

  return null;
}

type PersonaValidationInput = {
  cc: string;
  nombre: string;
  sexo: string;
  masaCorporal: number;
  talla: number;
  cintura?: number | null;
  cadera?: number | null;
  edad: number;
};

export type MedidasValidationErrors = {
  cintura?: string;
  cadera?: string;
  form?: string;
};

export type MedidasValidationResult =
  | {
      ok: true;
      data: {
        cintura: number;
        cadera: number;
      };
    }
  | {
      ok: false;
      errors: MedidasValidationErrors;
    };

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

export function validatePersonaInput(input: PersonaValidationInput): void {
  if (!input.cc.trim()) {
    throw new Error("El CC es obligatorio.");
  }

  if (!input.nombre.trim()) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!normalizeSexo(input.sexo)) {
    throw new Error("El sexo debe ser masculino o femenino.");
  }

  if (!isFiniteNumber(input.talla) || input.talla < 1.2 || input.talla > 2.2) {
    throw new Error(
      `La talla debe quedar entre 1.2 y 2.2 metros. Recibido: ${input.talla}. Si la ingresaste en centimetros, debe ser mayor que 3 para que se convierta automaticamente.`,
    );
  }

  if (
    !isFiniteNumber(input.masaCorporal) ||
    input.masaCorporal < 30 ||
    input.masaCorporal > 300
  ) {
    throw new Error(
      `La masa corporal debe quedar entre 30 y 300 kg. Recibido: ${input.masaCorporal}. Si la ingresaste en libras, debe ser mayor que 150 para que se convierta automaticamente.`,
    );
  }

  if (
    typeof input.cintura === "number" &&
    (!isFiniteNumber(input.cintura) ||
      input.cintura < CIRCUMFERENCE_MIN_CM ||
      input.cintura > CIRCUMFERENCE_MAX_CM)
  ) {
    throw new Error(
      `La cintura debe quedar entre 50 y 200 cm. Recibido: ${input.cintura}. Si la ingresaste en metros, debe ser menor que 10 para que se convierta automaticamente.`,
    );
  }

  if (
    typeof input.cadera === "number" &&
    (!isFiniteNumber(input.cadera) ||
      input.cadera < CIRCUMFERENCE_MIN_CM ||
      input.cadera > CIRCUMFERENCE_MAX_CM)
  ) {
    throw new Error(
      `La cadera debe quedar entre 50 y 200 cm. Recibido: ${input.cadera}. Si la ingresaste en metros, debe ser menor que 10 para que se convierta automaticamente.`,
    );
  }

  if (!Number.isInteger(input.edad) || input.edad <= 0) {
    throw new Error("La edad debe ser un entero positivo.");
  }
}

function getNumber(value: unknown): number {
  if (typeof value !== "number") {
    return Number.NaN;
  }

  return value;
}

export function validatePersonaMedidasInput(
  input: unknown,
): MedidasValidationResult {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: {
        form: "Debes enviar cintura y cadera.",
      },
    };
  }

  const payload = input as { cintura?: unknown; cadera?: unknown };
  const cintura = getNumber(payload.cintura);
  const cadera = getNumber(payload.cadera);
  const errors: MedidasValidationErrors = {};

  if (!isFiniteNumber(cintura)) {
    errors.cintura = "Ingresa un valor numerico para la cintura.";
  } else if (cintura < CIRCUMFERENCE_MIN_CM || cintura > CIRCUMFERENCE_MAX_CM) {
    errors.cintura = `La cintura debe estar entre ${CIRCUMFERENCE_MIN_CM} y ${CIRCUMFERENCE_MAX_CM} cm.`;
  }

  if (!isFiniteNumber(cadera)) {
    errors.cadera = "Ingresa un valor numerico para la cadera.";
  } else if (cadera < CIRCUMFERENCE_MIN_CM || cadera > CIRCUMFERENCE_MAX_CM) {
    errors.cadera = `La cadera debe estar entre ${CIRCUMFERENCE_MIN_CM} y ${CIRCUMFERENCE_MAX_CM} cm.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      cintura,
      cadera,
    },
  };
}
