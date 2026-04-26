import Link from "next/link";

import { Card } from "@/components/admin/Card";
import { StatCard } from "@/components/admin/StatCard";
import { Table } from "@/components/admin/Table";
import { formatDateTime } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const [
    totalPersonas,
    totalSesiones,
    totalEjercicios,
    totalResultados,
    latestPersonas,
    latestSesiones,
  ] = await prisma.$transaction([
    prisma.persona.count(),
    prisma.sesion.count(),
    prisma.ejercicio.count(),
    prisma.resultadoEjercicio.count(),
    prisma.persona.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        sesiones: true,
      },
    }),
    prisma.sesion.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        persona: true,
        resultados: {
          include: {
            ejercicio: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total personas" value={totalPersonas} />
        <StatCard label="Total sesiones" value={totalSesiones} />
        <StatCard label="Total ejercicios" value={totalEjercicios} />
        <StatCard label="Total resultados" value={totalResultados} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Ultimas personas"
          actions={
            <Link
              href="/admin/personas"
              className="text-sm text-text-secondary underline-offset-4 hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          <Table
            headers={["Nombre", "CC", "Sexo", "Sesiones"]}
            hasRows={latestPersonas.length > 0}
          >
            {latestPersonas.map((persona) => (
              <tr key={persona.id}>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  {persona.nombre}
                </td>
                <td className="px-4 py-3 text-text-secondary">{persona.cc}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {persona.sexo}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {persona.sesiones.length}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title="Ultimas sesiones"
          actions={
            <Link
              href="/admin/sesiones"
              className="text-sm text-text-secondary underline-offset-4 hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          <Table
            headers={["Sesion", "Persona", "Fecha", "Ejercicios"]}
            hasRows={latestSesiones.length > 0}
          >
            {latestSesiones.map((sesion) => (
              <tr key={sesion.id}>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  #{sesion.id}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {sesion.persona.nombre}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatDateTime(sesion.createdAt)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {sesion.resultados.length}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
