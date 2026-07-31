import Link from "next/link";

import { Table } from "@/components/admin/Table";
import { Card } from "@/components/admin/Card";
import { obtenerMacrociclosAdmin } from "@/services/macrociclo.service";
import { toISODate } from "@/lib/macrociclo";

export default async function AdminMacrociclosPage() {
  const macrociclos = await obtenerMacrociclosAdmin();

  return (
    <div className="space-y-4">
      <Card title="Macrociclos" subtitle="Listado completo de macrociclos">
        <Table
          headers={["ID", "Persona", "CC", "Objetivo", "Estado", "Fecha inicio", "Acción"]}
          hasRows={macrociclos.length > 0}
        >
          {macrociclos.map((macrociclo) => (
            <tr key={macrociclo.id}>
              <td className="px-4 py-3 text-text-primary dark:text-white">
                #{macrociclo.id}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {macrociclo.persona.nombre}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {macrociclo.persona.cc}
              </td>
              <td className="px-4 py-3 text-text-secondary capitalize">
                {macrociclo.objetivoTipo}
              </td>
              <td className="px-4 py-3 text-text-secondary capitalize">
                {macrociclo.estado}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {toISODate(macrociclo.fechaInicio)}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/macrociclos/${macrociclo.id}`}
                  className="text-sm text-accent underline-offset-4 hover:underline"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
