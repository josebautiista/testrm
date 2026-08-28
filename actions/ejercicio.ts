"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  actualizarEjercicio,
  crearEjercicio,
  isPatronMovimiento,
  isTipoEquipamiento,
  type EjercicioInput,
} from "@/services/ejercicio.service";

export type EjercicioFormState = {
  error: string | null;
};

function parseEjercicioInput(formData: FormData): EjercicioInput | { error: string } {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const patron = String(formData.get("patron") ?? "");
  const musculoPrimario = String(formData.get("musculoPrimario") ?? "").trim();
  const equipamiento = String(formData.get("equipamiento") ?? "");
  const musculosSecundariosRaw = String(formData.get("musculosSecundarios") ?? "");
  const incrementoMinimoKg = Number(formData.get("incrementoMinimoKg"));
  const porcentajeMasaHombre = Number(formData.get("porcentajeMasaHombre"));
  const porcentajeMasaMujer = Number(formData.get("porcentajeMasaMujer"));
  const esDeTiempo = formData.get("esDeTiempo") === "on";
  const admitePorcentajeRm = formData.get("admitePorcentajeRm") === "on";
  const esUnilateral = formData.get("esUnilateral") === "on";
  const enBateriaEvaluacion = formData.get("enBateriaEvaluacion") === "on";
  const activo = formData.get("activo") === "on";

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!isPatronMovimiento(patron)) return { error: "Patrón de movimiento inválido." };
  if (!isTipoEquipamiento(equipamiento)) return { error: "Tipo de equipamiento inválido." };
  if (!musculoPrimario) return { error: "El músculo primario es obligatorio." };
  if (!Number.isFinite(incrementoMinimoKg) || incrementoMinimoKg <= 0) {
    return { error: "El incremento mínimo debe ser un número mayor que 0." };
  }
  if (!Number.isFinite(porcentajeMasaHombre) || !Number.isFinite(porcentajeMasaMujer)) {
    return { error: "Los porcentajes de masa corporal deben ser números." };
  }

  return {
    nombre,
    patron,
    musculoPrimario,
    musculosSecundarios: musculosSecundariosRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    equipamiento,
    incrementoMinimoKg,
    porcentajeMasaHombre,
    porcentajeMasaMujer,
    admitePorcentajeRm,
    esDeTiempo,
    esUnilateral,
    enBateriaEvaluacion,
    activo,
  };
}

export async function crearEjercicioAction(
  _prevState: EjercicioFormState,
  formData: FormData,
): Promise<EjercicioFormState> {
  const parsed = parseEjercicioInput(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    await crearEjercicio(parsed);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No fue posible crear el ejercicio.",
    };
  }

  revalidatePath("/admin/ejercicios");
  redirect("/admin/ejercicios");
}

export async function actualizarEjercicioAction(
  id: number,
  _prevState: EjercicioFormState,
  formData: FormData,
): Promise<EjercicioFormState> {
  const parsed = parseEjercicioInput(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    await actualizarEjercicio(id, parsed);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No fue posible actualizar el ejercicio.",
    };
  }

  revalidatePath("/admin/ejercicios");
  redirect("/admin/ejercicios");
}
