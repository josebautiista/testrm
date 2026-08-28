import { Card } from "@/components/admin/Card";
import { EjercicioForm } from "@/components/admin/EjercicioForm";
import { crearEjercicioAction } from "@/actions/ejercicio";

export default function NuevoEjercicioPage() {
  return (
    <Card title="Nuevo ejercicio" subtitle="C-01/TASK-013: patrón, equipamiento y calibración del test">
      <EjercicioForm action={crearEjercicioAction} submitLabel="Crear ejercicio" />
    </Card>
  );
}
