import { notFound } from "next/navigation";

import { Card } from "@/components/admin/Card";
import { EjercicioForm } from "@/components/admin/EjercicioForm";
import { actualizarEjercicioAction } from "@/actions/ejercicio";
import { obtenerEjercicio } from "@/services/ejercicio.service";

export default async function EditarEjercicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const ejercicio = await obtenerEjercicio(id);

  if (!ejercicio) {
    notFound();
  }

  const actionConId = actualizarEjercicioAction.bind(null, id);

  return (
    <Card title={`Editar: ${ejercicio.nombre}`} subtitle={`Ejercicio #${ejercicio.id}`}>
      <EjercicioForm
        action={actionConId}
        submitLabel="Guardar cambios"
        ejercicio={{
          nombre: ejercicio.nombre,
          patron: ejercicio.patron,
          musculoPrimario: ejercicio.musculoPrimario,
          musculosSecundarios: Array.isArray(ejercicio.musculosSecundarios)
            ? (ejercicio.musculosSecundarios as string[])
            : [],
          equipamiento: ejercicio.equipamiento,
          incrementoMinimoKg: ejercicio.incrementoMinimoKg,
          porcentajeMasaHombre: ejercicio.porcentajeMasaHombre,
          porcentajeMasaMujer: ejercicio.porcentajeMasaMujer,
          admitePorcentajeRm: ejercicio.admitePorcentajeRm,
          esDeTiempo: ejercicio.esDeTiempo,
          esUnilateral: ejercicio.esUnilateral,
          enBateriaEvaluacion: ejercicio.enBateriaEvaluacion,
          activo: ejercicio.activo,
        }}
      />
    </Card>
  );
}
