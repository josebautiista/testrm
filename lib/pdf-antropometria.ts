import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import { type MedidasSnapshot } from "./macrociclo";

function removeTildes(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(value: string): number | undefined {
  const normalized = value.replace(",", ".").replace(/[\s%]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePercentage(value: string): number | undefined {
  return parseNumber(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Busca la primera ocurrencia de alguna de las etiquetas y devuelve el
 * primer número que aparece después, ignorando unidades, referencias y
 * columnas intermedias.
 *
 * El formato ISAKMetry puede tener varias columnas seguidas:
 *   Label (unidad)   actual   previo   diferencia   z-score
 * Siempre nos quedamos con el primer valor numérico (la medida actual).
 */
function findValueNearLabel(
  text: string,
  labels: string[],
): string | undefined {
  const normalizedText = removeTildes(text).toLowerCase();
  for (const label of labels) {
    const normalizedLabel = removeTildes(label).toLowerCase();
    // El label debe estar como palabra completa.
    // Permitimos "Label (unidad)" y cualquier cantidad de pares de paréntesis
    // (p. ej. "Masa grasa (kg) (Jackson y Pollock, 1975)").
    // Luego ignoramos todo lo que no sea un dígito hasta encontrar el primer número.
    const regex = new RegExp(
      `\\b${escapeRegex(normalizedLabel)}(?:\\s*\\([^)]*\\))*\\s*[^0-9.,+-]*?([-+]?\\d*[.,]?\\d+)`,
      "i",
    );
    const match = normalizedText.match(regex);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/**
 * Extrae un campo de texto ubicado entre dos etiquetas conocidas.
 * Útil para el encabezado del PDF donde todo está en una sola línea:
 *   Nombre: X   Evaluado por: Y   Edad: Z ...
 */
function findTextBetweenLabels(
  text: string,
  startLabels: string[],
  endLabels: string[],
): string | undefined {
  const normalizedText = removeTildes(text).toLowerCase();

  let startPos = -1;
  for (const label of startLabels) {
    const normalizedLabel = removeTildes(label).toLowerCase();
    const regex = new RegExp(
      `\\b${escapeRegex(normalizedLabel)}\\s*[:=]\\s*`,
      "i",
    );
    const match = normalizedText.match(regex);
    if (match && match.index !== undefined) {
      startPos = match.index + match[0].length;
      break;
    }
  }
  if (startPos === -1) return undefined;

  const remaining = normalizedText.slice(startPos);

  // Si inmediatamente después viene otro label, el campo está vacío.
  const emptyCheckPattern = endLabels
    .map((l) => escapeRegex(removeTildes(l).toLowerCase()))
    .join("|");
  const emptyRegex = new RegExp(
    `^(?:\\s*n[º°])?\\s*[:=]|^\\s*(?:${emptyCheckPattern})(?:\\s*n[º°])?\\s*[:=]`,
    "i",
  );
  if (emptyRegex.test(remaining)) {
    return undefined;
  }

  let endPos = normalizedText.length;
  for (const label of endLabels) {
    const normalizedLabel = removeTildes(label).toLowerCase();
    const regex = new RegExp(
      `\\s+${escapeRegex(normalizedLabel)}(?:\\s*n[º°])?\\s*[:=]`,
      "i",
    );
    const match = remaining.match(regex);
    if (match && match.index !== undefined) {
      endPos = Math.min(endPos, startPos + match.index);
    }
  }

  const value = text.slice(startPos, endPos).trim();
  return value || undefined;
}

/**
 * Extrae un campo de texto simple ubicado cerca de una etiqueta.
 * Ejemplo: "Nombre:   CAMILO ANDRÉS LOZANO"
 */
function findTextAfterLabel(
  text: string,
  labels: string[],
): string | undefined {
  return findTextBetweenLabels(text, labels, []);
}

/**
 * Extrae una sección delimitada por un título y el siguiente título conocido.
 * Devuelve el texto original (preservando casing) para que el resto de
 * extractores puedan trabajar sobre él.
 */
function extraerSeccion(
  text: string,
  titulo: string,
  siguientesTitulos: string[],
): string {
  const normalizedText = removeTildes(text).toLowerCase();
  const normalizedTitulo = removeTildes(titulo).toLowerCase();
  const startRegex = new RegExp(`\\b${escapeRegex(normalizedTitulo)}\\b`, "i");
  const startMatch = normalizedText.match(startRegex);
  if (!startMatch || startMatch.index === undefined) return "";

  const startPos = startMatch.index + startMatch[0].length;
  let endPos = normalizedText.length;

  for (const siguiente of siguientesTitulos) {
    const normalizedSiguiente = removeTildes(siguiente).toLowerCase();
    const regex = new RegExp(`\\b${escapeRegex(normalizedSiguiente)}\\b`, "i");
    const match = normalizedText.slice(startPos).match(regex);
    if (match && match.index !== undefined) {
      endPos = Math.min(endPos, startPos + match.index);
    }
  }

  return text.slice(startPos, endPos);
}

function parseDateDDMMYYYY(value: string): string | undefined {
  const match = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const workerPath = path
    .join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
    .replace(/\\/g, "/");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) =>
        typeof item === "object" && "str" in item ? (item.str as string) : "",
      )
      .join(" ");
    parts.push(pageText);
  }

  return parts.join("\n");
}

export function extraerAntropometriaDesdeTexto(text: string): {
  medidas: MedidasSnapshot;
  rawText: string;
  reconocido: boolean;
} {
  if (!text || text.trim().length === 0) {
    return {
      medidas: {},
      rawText: "",
      reconocido: false,
    };
  }

  const raw: Record<string, unknown> = {};

  // --- Metadata ---
  const metadata: MedidasSnapshot["metadata"] = {};

  const headerEndLabels = [
    "Evaluado por",
    "Edad",
    "Certificacion",
    "Certificación",
    "Genero",
    "Género",
    "Evaluacion",
    "Evaluación",
    "Deporte",
    "Fecha",
    "Nivel de actividad",
  ];

  const nombreRaw = findTextBetweenLabels(
    text,
    ["Nombre"],
    ["Evaluado por", ...headerEndLabels],
  );
  const evaluadorRaw = findTextBetweenLabels(
    text,
    ["Evaluado por"],
    [...headerEndLabels],
  );
  const edadRaw = findValueNearLabel(text, ["Edad"]);
  const generoRaw = findTextBetweenLabels(
    text,
    ["Genero", "Género"],
    [...headerEndLabels],
  );
  const deporteRaw = findTextBetweenLabels(
    text,
    ["Deporte"],
    [...headerEndLabels],
  );
  const fechaRaw = findTextBetweenLabels(text, ["Fecha"], [...headerEndLabels]);

  if (nombreRaw) metadata.nombre = nombreRaw.replace(/\s+/g, " ").trim();
  if (evaluadorRaw)
    metadata.evaluador = evaluadorRaw.replace(/\s+/g, " ").trim();
  if (edadRaw) {
    const edad = parseNumber(edadRaw);
    if (edad !== undefined) metadata.edad = Math.round(edad);
  }
  if (generoRaw) metadata.genero = generoRaw.replace(/\s+/g, " ").trim();
  if (deporteRaw) metadata.deporte = deporteRaw.replace(/\s+/g, " ").trim();
  if (fechaRaw) {
    const iso = parseDateDDMMYYYY(fechaRaw);
    if (iso) metadata.fechaEvaluacion = iso;
  }

  // --- Medidas básicas ---
  const masaCorporal = findValueNearLabel(text, [
    "Masa corporal (kg)",
    "Masa corporal",
    "Peso",
    "Masa total",
    "Body weight",
  ]);
  const talla = findValueNearLabel(text, [
    "Talla (cm)",
    "Talla",
    "Estatura",
    "Height",
  ]);
  const tallaSentado = findValueNearLabel(text, [
    "Talla sentado (cm)",
    "Talla sentado",
    "Sentado",
    "Sitting height",
  ]);
  const envergadura = findValueNearLabel(text, [
    "Envergadura de brazos (cm)",
    "Envergadura de brazos",
    "Envergadura (cm)",
    "Envergadura",
    "Wingspan",
    "Arm span",
  ]);

  if (masaCorporal) raw["masaCorporal"] = parseNumber(masaCorporal);
  if (talla) raw["talla"] = parseNumber(talla);
  if (tallaSentado) raw["tallaSentado"] = parseNumber(tallaSentado);
  if (envergadura) raw["envergadura"] = parseNumber(envergadura);

  // --- Pliegues ---
  const plieguesLabels: Record<string, string[]> = {
    tricepsMm: ["Triceps (mm)", "Tríceps (mm)", "Triceps", "Tríceps"],
    subescapularMm: ["Subescapular (mm)", "Subescapular"],
    bicepsMm: ["Biceps (mm)", "Bíceps (mm)", "Biceps", "Bíceps"],
    crestaIliacaMm: [
      "Cresta iliaca (mm)",
      "Cresta ilíaca (mm)",
      "Cresta iliaca",
      "Cresta ilíaca",
    ],
    supraespinalMm: ["Supraespinal (mm)", "Supraespinal", "Supraespinale"],
    abdominalMm: ["Abdominal (mm)", "Abdominal"],
    musloMm: ["Muslo (mm)", "Muslo", "Thigh"],
    piernaMm: ["Pierna (mm)", "Pierna", "Leg"],
  };

  const pliegues: MedidasSnapshot["pliegues"] = {};
  for (const [key, labels] of Object.entries(plieguesLabels)) {
    const value = findValueNearLabel(text, labels);
    if (value) {
      const parsedValue = parseNumber(value);
      if (parsedValue !== undefined) {
        (pliegues as Record<string, number>)[key] = parsedValue;
        raw[key] = parsedValue;
      }
    }
  }

  // --- Perímetros ---
  const perimetrosLabels: Record<string, string[]> = {
    brazoRelajadoCm: ["Brazo relajado (cm)", "Brazo relajado"],
    brazoFlexionadoContraidoCm: [
      "Brazo flexionado y contraido (cm)",
      "Brazo flexionado y contraído (cm)",
      "Brazo flexionado (cm)",
      "Brazo flexionado",
      "Brazo flex",
    ],
    cinturaCm: ["Cintura (cm)", "Cintura", "Waist"],
    caderaCm: ["Caderas (cm)", "Cadera (cm)", "Caderas", "Cadera", "Hip"],
    musloMedioCm: ["Muslo medio (cm)", "Muslo medio", "Mid thigh"],
    piernaCm: [
      "Pierna (cm)",
      "Pierna",
      "Pantorrilla (cm)",
      "Pantorrilla",
      "Calf",
    ],
  };

  const perimetros: MedidasSnapshot["perimetros"] = {};
  for (const [key, labels] of Object.entries(perimetrosLabels)) {
    const value = findValueNearLabel(text, labels);
    if (value) {
      const parsedValue = parseNumber(value);
      if (parsedValue !== undefined) {
        (perimetros as Record<string, number>)[key] = parsedValue;
        raw[key] = parsedValue;
      }
    }
  }

  // --- Diámetros ---
  const diametrosLabels: Record<string, string[]> = {
    humeroCm: ["Húmero (cm)", "Humero (cm)", "Húmero", "Humero", "Humerus"],
    biestiloideoCm: [
      "Biestiloideo (cm)",
      "Biestiloides (cm)",
      "Biestiloideo",
      "Biestiloides",
      "Bistyloid",
    ],
    femurCm: ["Fémur (cm)", "Femur (cm)", "Fémur", "Femur"],
  };

  const diametros: MedidasSnapshot["diametros"] = {};
  for (const [key, labels] of Object.entries(diametrosLabels)) {
    const value = findValueNearLabel(text, labels);
    if (value) {
      const parsedValue = parseNumber(value);
      if (parsedValue !== undefined) {
        (diametros as Record<string, number>)[key] = parsedValue;
        raw[key] = parsedValue;
      }
    }
  }

  // --- Composición corporal ---
  const composicionLabels: Record<string, string[]> = {
    masaGrasaKg: ["Masa grasa"],
    masaLibreGrasaKg: ["Masa libre de grasa"],
    tejidoAdiposoKg: ["Tejido adiposo"],
    tejidoMuscularKg: ["Tejido muscular"],
    tejidoOseoKg: ["Tejido oseo", "Tejido óseo"],
  };

  const composicionCorporal: MedidasSnapshot["composicionCorporal"] = {};
  for (const [key, labels] of Object.entries(composicionLabels)) {
    const value = findValueNearLabel(text, labels);
    if (value) {
      const parsedValue = parseNumber(value);
      if (parsedValue !== undefined) {
        (composicionCorporal as Record<string, number>)[key] = parsedValue;
        raw[key] = parsedValue;
      }
    }
  }

  // --- Adiposidad ---
  const adiposidadLabels: Record<string, string[]> = {
    sumatorio6PlieguesMm: ["Sumatorio de 6 pliegues"],
    sumatorio8PlieguesMm: ["Sumatorio de 8 pliegues"],
  };

  const adiposidad: MedidasSnapshot["adiposidad"] = {};
  for (const [key, labels] of Object.entries(adiposidadLabels)) {
    const value = findValueNearLabel(text, labels);
    if (value) {
      const parsedValue = parseNumber(value);
      if (parsedValue !== undefined) {
        (adiposidad as Record<string, number>)[key] = parsedValue;
        raw[key] = parsedValue;
      }
    }
  }

  // --- Distribución adiposo muscular ---
  const distribucionSection = extraerSeccion(
    text,
    "Distribución adiposo muscular",
    [
      "Índices de composición corporal",
      "Indice adiposo muscular",
      "Adiposidad",
      "Muscularidad",
      "Índices de salud",
    ],
  );

  const distribucionAdiposoMuscular: MedidasSnapshot["distribucionAdiposoMuscular"] =
    {};
  if (distribucionSection) {
    const masaGrasaSuperior = findValueNearLabel(distribucionSection, [
      "Superior",
    ]);
    const masaGrasaCentral = findValueNearLabel(distribucionSection, [
      "Central",
    ]);
    const masaGrasaInferior = findValueNearLabel(distribucionSection, [
      "Inferior",
    ]);
    const tejidoMuscularBrazo = findValueNearLabel(distribucionSection, [
      "Brazo",
    ]);
    const tejidoMuscularMuslo = findValueNearLabel(distribucionSection, [
      "Muslo",
    ]);
    const tejidoMuscularPierna = findValueNearLabel(distribucionSection, [
      "Pierna",
    ]);

    const grasa: NonNullable<
      MedidasSnapshot["distribucionAdiposoMuscular"]
    >["masaGrasa"] = {};
    const muscular: NonNullable<
      MedidasSnapshot["distribucionAdiposoMuscular"]
    >["tejidoMuscular"] = {};

    if (masaGrasaSuperior !== undefined) {
      grasa.superiorPct = parsePercentage(masaGrasaSuperior);
      raw["masaGrasaSuperiorPct"] = grasa.superiorPct;
    }
    if (masaGrasaCentral !== undefined) {
      grasa.centralPct = parsePercentage(masaGrasaCentral);
      raw["masaGrasaCentralPct"] = grasa.centralPct;
    }
    if (masaGrasaInferior !== undefined) {
      grasa.inferiorPct = parsePercentage(masaGrasaInferior);
      raw["masaGrasaInferiorPct"] = grasa.inferiorPct;
    }
    if (tejidoMuscularBrazo !== undefined) {
      muscular.brazoPct = parsePercentage(tejidoMuscularBrazo);
      raw["tejidoMuscularBrazoPct"] = muscular.brazoPct;
    }
    if (tejidoMuscularMuslo !== undefined) {
      muscular.musloPct = parsePercentage(tejidoMuscularMuslo);
      raw["tejidoMuscularMusloPct"] = muscular.musloPct;
    }
    if (tejidoMuscularPierna !== undefined) {
      muscular.piernaPct = parsePercentage(tejidoMuscularPierna);
      raw["tejidoMuscularPiernaPct"] = muscular.piernaPct;
    }

    if (Object.keys(grasa).length > 0 || Object.keys(muscular).length > 0) {
      distribucionAdiposoMuscular.masaGrasa = grasa;
      distribucionAdiposoMuscular.tejidoMuscular = muscular;
    }
  }

  // --- Índices de salud ---
  const imc = findValueNearLabel(text, ["IMC", "Body mass index", "BMI"]);
  const icc = findValueNearLabel(text, [
    "Indice cintura cadera",
    "Índice cintura cadera",
    "ICC",
  ]);
  const indiceConicidad = findValueNearLabel(text, [
    "Indice de conicidad",
    "Índice de conicidad",
  ]);
  const indiceCinturaTalla = findValueNearLabel(text, [
    "Indice cintura talla",
    "Índice cintura talla",
  ]);

  const indicesSalud: MedidasSnapshot["indicesSalud"] = {};
  if (imc) {
    indicesSalud.imc = parseNumber(imc);
    raw["imc"] = indicesSalud.imc;
  }
  if (icc) {
    indicesSalud.indiceCinturaCadera = parseNumber(icc);
    raw["indiceCinturaCadera"] = indicesSalud.indiceCinturaCadera;
  }
  if (indiceConicidad) {
    indicesSalud.indiceConicidad = parseNumber(indiceConicidad);
    raw["indiceConicidad"] = indicesSalud.indiceConicidad;
  }
  if (indiceCinturaTalla) {
    indicesSalud.indiceCinturaTalla = parseNumber(indiceCinturaTalla);
    raw["indiceCinturaTalla"] = indicesSalud.indiceCinturaTalla;
  }

  const medidas: MedidasSnapshot = {
    metadata,
    medidasBasicas: {
      masaCorporalKg: parseNumber(masaCorporal ?? ""),
      tallaCm: parseNumber(talla ?? ""),
      tallaSentadoCm: parseNumber(tallaSentado ?? ""),
      envergaduraBrazosCm: parseNumber(envergadura ?? ""),
    },
    pliegues,
    perimetros,
    diametros,
    composicionCorporal,
    adiposidad,
    distribucionAdiposoMuscular,
    indicesSalud,
    extractedDataRaw: raw,
  };

  const reconocido = Object.keys(raw).length > 0;

  return { medidas, rawText: text, reconocido };
}

export async function extraerAntropometriaDesdePdf(
  buffer: Buffer,
): Promise<{ medidas: MedidasSnapshot; rawText: string; reconocido: boolean }> {
  const text = await extraerTextoPdf(buffer);
  return extraerAntropometriaDesdeTexto(text);
}
