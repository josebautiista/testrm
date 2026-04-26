import { Card } from "@/components/admin/Card";
import { Pagination } from "@/components/admin/Pagination";
import { Table } from "@/components/admin/Table";
import { formatDateTime, parsePageParam } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 15;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminSesionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams.page);

  const [total, sesiones] = await prisma.$transaction([
    prisma.sesion.count(),
    prisma.sesion.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card title="Sesiones" subtitle={`Total: ${total}`}>
      <Table
        headers={["Sesion", "Persona", "Fecha", "Cantidad ejercicios"]}
        hasRows={sesiones.length > 0}
      >
        {sesiones.map((sesion) => (
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

      <Pagination
        currentPage={Math.min(page, totalPages)}
        totalPages={totalPages}
        basePath="/admin/sesiones"
      />
    </Card>
  );
}
