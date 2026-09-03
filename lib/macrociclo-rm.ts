export type SesionRmConResultados<T> = {
  createdAt: Date;
  resultados: T[];
};

/** Conserva el resultado de la sesión más reciente por cada ejercicio. */
export function combinarResultadosRmMasRecientes<T extends { ejercicioId: number }>(
  sesiones: SesionRmConResultados<T>[],
): T[] {
  const ordenadas = [...sesiones].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const porEjercicio = new Map<number, T>();

  for (const sesion of ordenadas) {
    for (const resultado of sesion.resultados) {
      if (!porEjercicio.has(resultado.ejercicioId)) {
        porEjercicio.set(resultado.ejercicioId, resultado);
      }
    }
  }

  return [...porEjercicio.values()];
}
