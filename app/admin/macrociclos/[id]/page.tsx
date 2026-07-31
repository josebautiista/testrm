import { notFound } from "next/navigation";

import { Card } from "@/components/admin/Card";
import { Table } from "@/components/admin/Table";
import { obtenerMacrocicloPorId } from "@/services/macrociclo.service";
import { toISODate } from "@/lib/macrociclo";

export default async function AdminMacrocicloDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const id = Number(resolvedParams.id);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const macrociclo = await obtenerMacrocicloPorId(id);

  if (!macrociclo) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Card title={`Macrociclo #${macrociclo.id}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-text-secondary">Persona</p>
            <p className="font-medium text-text-primary dark:text-white">
              {macrociclo.persona.nombre} ({macrociclo.persona.cc})
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Estado</p>
            <p className="font-medium capitalize text-text-primary dark:text-white">
              {macrociclo.estado}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Objetivo</p>
            <p className="font-medium capitalize text-text-primary dark:text-white">
              {macrociclo.objetivoTipo}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Rango</p>
            <p className="font-medium text-text-primary dark:text-white">
              {toISODate(macrociclo.fechaInicio)} - {toISODate(macrociclo.fechaFin)}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Semanas">
        <Table
          headers={["Semana", "Fechas", "Microciclo", "Frecuencia", "Volumen", "Intensidad"]}
          hasRows={macrociclo.semanas.length > 0}
        >
          {macrociclo.semanas.map((semana) => (
            <tr key={semana.id}>
              <td className="px-4 py-3 text-text-primary dark:text-white">
                {semana.numeroSemana}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {toISODate(semana.fechaInicio)} - {toISODate(semana.fechaFin)}
              </td>
              <td className="px-4 py-3 text-text-secondary capitalize">
                {semana.tipoMicrociclo}
              </td>
              <td className="px-4 py-3 text-text-secondary">{semana.frecuencia}</td>
              <td className="px-4 py-3 text-text-secondary">{semana.volumen} kg</td>
              <td className="px-4 py-3 text-text-secondary">{semana.intensidad}%</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Auditoría">
        <Table
          headers={["Fecha", "Usuario", "Acción"]}
          hasRows={macrociclo.auditLogs.length > 0}
        >
          {macrociclo.auditLogs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-text-secondary">
                {new Intl.DateTimeFormat("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(log.createdAt)}
              </td>
              <td className="px-4 py-3 text-text-secondary capitalize">
                {log.userType}
                {log.adminId ? ` (#${log.adminId})` : ""}
              </td>
              <td className="px-4 py-3 text-text-primary dark:text-white">
                {log.action}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
