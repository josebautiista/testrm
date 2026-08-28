// Constantes y tipos puros del catálogo de ejercicios (C-01/TASK-013).
// Deliberadamente sin importar Prisma: components/admin/EjercicioForm.tsx
// (cliente) necesita PATRONES_MOVIMIENTO/TIPOS_EQUIPAMIENTO, y si esas
// constantes vivieran en services/ejercicio.service.ts (que sí importa
// lib/prisma.ts -> mariadb -> `fs`), el bundle del cliente fallaría al
// compilar ("Module not found: Can't resolve 'fs'").

export const PATRONES_MOVIMIENTO = [
  "sentadilla",
  "bisagra",
  "empuje_horizontal",
  "empuje_vertical",
  "traccion_horizontal",
  "traccion_vertical",
  "core",
  "accesorio",
  "cardio",
] as const;
export type PatronMovimiento = (typeof PATRONES_MOVIMIENTO)[number];

export const TIPOS_EQUIPAMIENTO = [
  "barra",
  "mancuerna",
  "maquina",
  "polea",
  "peso_corporal",
  "otro",
] as const;
export type TipoEquipamiento = (typeof TIPOS_EQUIPAMIENTO)[number];

export function isPatronMovimiento(value: unknown): value is PatronMovimiento {
  return (
    typeof value === "string" &&
    (PATRONES_MOVIMIENTO as readonly string[]).includes(value)
  );
}

export function isTipoEquipamiento(value: unknown): value is TipoEquipamiento {
  return (
    typeof value === "string" &&
    (TIPOS_EQUIPAMIENTO as readonly string[]).includes(value)
  );
}

export type EjercicioInput = {
  nombre: string;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
  patron: PatronMovimiento;
  musculoPrimario: string;
  musculosSecundarios: string[];
  equipamiento: TipoEquipamiento;
  incrementoMinimoKg: number;
  admitePorcentajeRm: boolean;
  esDeTiempo: boolean;
  esUnilateral: boolean;
  enBateriaEvaluacion: boolean;
  activo: boolean;
};
