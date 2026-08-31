import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { Card } from "@/components/admin/Card";
import { Pagination } from "@/components/admin/Pagination";
import { Table } from "@/components/admin/Table";
import { parsePageParam } from "@/lib/admin";
import { getAuthUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 12;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams.page);

  const authUser = await getAuthUserFromCookies();
  const personaWhere: Prisma.PersonaWhereInput =
    authUser?.role === "admin" ? {} : { entrenadorId: authUser?.userId ?? "" };

  const [total, personas] = await prisma.$transaction([
    prisma.persona.count({ where: personaWhere }),
    prisma.persona.findMany({
      where: personaWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        sesiones: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card
      title="Personas"
      subtitle={`Total: ${total} registros`}
      actions={
        <Link
          href="/admin"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-text-primary hover:bg-bg-main dark:border-white/10 dark:text-white"
        >
          Volver
        </Link>
      }
    >
      <Table
        headers={[
          "Nombre",
          "CC",
          "Sexo",
          "Edad",
          "Masa",
          "Sesiones",
          "Detalle",
        ]}
        hasRows={personas.length > 0}
      >
        {personas.map((persona) => (
          <tr key={persona.id}>
            <td className="px-4 py-3 text-text-primary dark:text-white">
              {persona.nombre}
            </td>
            <td className="px-4 py-3 text-text-secondary">{persona.cc}</td>
            <td className="px-4 py-3 text-text-secondary">{persona.sexo}</td>
            <td className="px-4 py-3 text-text-secondary">{persona.edad}</td>
            <td className="px-4 py-3 text-text-secondary">
              {persona.masaCorporal}
            </td>
            <td className="px-4 py-3 text-text-secondary">
              {persona.sesiones.length}
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/admin/personas/${persona.id}`}
                className="text-text-primary underline-offset-4 hover:underline dark:text-white"
              >
                Ver
              </Link>
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        currentPage={Math.min(page, totalPages)}
        totalPages={totalPages}
        basePath="/admin/personas"
      />
    </Card>
  );
}
