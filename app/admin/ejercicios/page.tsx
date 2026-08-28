import Link from "next/link";

import { Card } from "@/components/admin/Card";
import { Pagination } from "@/components/admin/Pagination";
import { Table } from "@/components/admin/Table";
import { parsePageParam } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 15;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminEjerciciosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams.page);

  const [total, ejercicios] = await prisma.$transaction([
    prisma.ejercicio.count(),
    prisma.ejercicio.findMany({
      orderBy: { id: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        resultados: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card
      title="Ejercicios"
      subtitle={`Total: ${total}`}
      actions={
        <Link
          href="/admin/ejercicios/nuevo"
          className="rounded-xl border border-transparent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Nuevo ejercicio
        </Link>
      }
    >
      <Table
        headers={[
          "ID",
          "Nombre",
          "Patrón",
          "Equipamiento",
          "Incremento (kg)",
          "% Masa H",
          "% Masa M",
          "Es de tiempo",
          "Activo",
          "Resultados",
          "",
        ]}
        hasRows={ejercicios.length > 0}
      >
        {ejercicios.map((ejercicio) => (
          <tr key={ejercicio.id}>
            <td className="px-4 py-3 text-text-secondary">{ejercicio.id}</td>
            <td className="px-4 py-3 text-text-primary dark:text-white">
              {ejercicio.nombre}
            </td>
            <td className="px-4 py-3 text-text-secondary">{ejercicio.patron}</td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.equipamiento}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.incrementoMinimoKg}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.porcentajeMasaHombre}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.porcentajeMasaMujer}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.esDeTiempo ? "Sí" : "No"}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.activo ? "Sí" : "No"}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {ejercicio.resultados.length}
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/ejercicios/${ejercicio.id}`}
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                Editar
              </Link>
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        currentPage={Math.min(page, totalPages)}
        totalPages={totalPages}
        basePath="/admin/ejercicios"
      />
    </Card>
  );
}
