// D-17/TASK-015: EXERCISES_WITHOUT_LOAD (un Set de ids hardcodeados) se
// retiró — el campo `Ejercicio.esDeTiempo` en la base de datos es ahora la
// única fuente de verdad sobre si un ejercicio se prescribe por carga.

export const EXERCISE_NOTES: Record<number, string> = {
  2: "No incluyas el peso del carro/cajón (sled) de la máquina, solo las placas añadidas.",
  6: "Se sugiere realizarlo acostado, boca abajo.",
};
