import { prisma } from "@/lib/prisma";
import {
  isPatronMovimiento,
  isTipoEquipamiento,
  PATRONES_MOVIMIENTO,
  TIPOS_EQUIPAMIENTO,
  type EjercicioInput,
  type PatronMovimiento,
  type TipoEquipamiento,
} from "@/lib/ejercicio-catalogo";

export {
  isPatronMovimiento,
  isTipoEquipamiento,
  PATRONES_MOVIMIENTO,
  TIPOS_EQUIPAMIENTO,
  type EjercicioInput,
  type PatronMovimiento,
  type TipoEquipamiento,
};

/**
 * C-01/§3.2: esDeTiempo implica que no admite prescripción por %1RM — esto
 * sustituye a lib/ejercicios-config.ts EXERCISES_WITHOUT_LOAD (D-17).
 */
function normalizarInput(input: EjercicioInput): EjercicioInput {
  return {
    ...input,
    admitePorcentajeRm: input.esDeTiempo ? false : input.admitePorcentajeRm,
    incrementoMinimoKg:
      Number.isFinite(input.incrementoMinimoKg) && input.incrementoMinimoKg > 0
        ? input.incrementoMinimoKg
        : 2.5,
  };
}

export async function listarEjercicios(options?: { soloActivos?: boolean }) {
  return prisma.ejercicio.findMany({
    where: options?.soloActivos
      ? { activo: true, esEjercicioLibre: false }
      : { esEjercicioLibre: false },
    orderBy: { id: "asc" },
  });
}

export async function listarEjerciciosBateriaEvaluacion() {
  return prisma.ejercicio.findMany({
    where: { activo: true, enBateriaEvaluacion: true },
    orderBy: { id: "asc" },
  });
}

export async function obtenerEjercicio(id: number) {
  return prisma.ejercicio.findUnique({ where: { id } });
}

export async function crearEjercicio(input: EjercicioInput) {
  const data = normalizarInput(input);
  return prisma.ejercicio.create({ data });
}

export async function actualizarEjercicio(id: number, input: EjercicioInput) {
  const data = normalizarInput(input);
  return prisma.ejercicio.update({ where: { id }, data });
}

export async function desactivarEjercicio(id: number) {
  return prisma.ejercicio.update({ where: { id }, data: { activo: false } });
}
