import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/admin/Card";
import { Table } from "@/components/admin/Table";
import { formatDateTime } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type RouteParams = Promise<{ id: string }>;

export default async function PersonaDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const personaId = Number(id);

  if (!Number.isFinite(personaId)) {
    notFound();
  }

  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
    include: {
      sesiones: {
        orderBy: { createdAt: "desc" },
        include: {
          resultados: {
            include: {
              ejercicio: true,
            },
            orderBy: {
              ejercicioId: "asc",
            },
          },
        },
      },
    },
  });

  if (!persona) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Card
        title={persona.nombre}
        subtitle={`CC ${persona.cc}`}
        actions={
          <Link
            href="/admin/personas"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-text-primary hover:bg-bg-main dark:border-white/10 dark:text-white"
          >
            Volver a personas
          </Link>
        }
      >
        <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
          <p>Sexo: {persona.sexo}</p>
          <p>Edad: {persona.edad}</p>
          <p>Masa corporal: {persona.masaCorporal}</p>
          <p>Talla: {persona.talla}</p>
          <p>Cintura: {persona.cintura ?? "--"}</p>
          <p>Cadera: {persona.cadera ?? "--"}</p>
          <p>Entrenado: {persona.entrenado ? "Si" : "No"}</p>
          <p>Creado: {formatDateTime(persona.createdAt)}</p>
        </div>
      </Card>

      <Card title="Sesiones" subtitle={`Total: ${persona.sesiones.length}`}>
        {persona.sesiones.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Esta persona no tiene sesiones.
          </p>
        ) : (
          <div className="space-y-4">
            {persona.sesiones.map((sesion) => (
              <article
                key={sesion.id}
                className="space-y-3 rounded-xl border border-gray-200 bg-bg-main p-4 dark:border-white/8"
              >
                <p className="text-sm text-text-secondary">
                  Sesion #{sesion.id} - {formatDateTime(sesion.createdAt)}
                </p>

                <Table
                  headers={[
                    "Ejercicio",
                    "Reps",
                    "Carga",
                    "Epley",
                    "Brzycki",
                    "Lombardi",
                    "Lander",
                    "Oconnor",
                    "Mayhew",
                    "Wathen",
                    "Baechle",
                    "Casas",
                    "Nacleiro",
                  ]}
                  hasRows={sesion.resultados.length > 0}
                  emptyMessage="Sin resultados en esta sesion."
                >
                  {sesion.resultados.map((resultado) => (
                    <tr key={resultado.id}>
                      <td className="px-4 py-3 text-text-primary dark:text-white">
                        {resultado.ejercicio.nombre}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.repeticiones}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.carga}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.epley}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.brzycki}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.lombardi}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.lander}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.oconnor}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.mayhew}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.wathen}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.baechle}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.casas}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {resultado.nacleiro}
                      </td>
                    </tr>
                  ))}
                </Table>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
