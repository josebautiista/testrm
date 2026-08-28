"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { aceptarAjusteAction, rechazarAjusteAction } from "@/actions/progresion";

type Ajuste = {
  id: number;
  personaId: number;
  alcance: string;
  tipo: string;
  magnitud: number | null;
  justificacion: string;
  evidencia: Record<string, unknown>;
  createdAt: Date;
};

type Resolucion = "aceptado" | "rechazado";

const TIPO_LABEL: Record<string, string> = {
  subir_carga: "Subir carga",
  bajar_carga: "Bajar carga",
  subir_volumen: "Subir volumen",
  bajar_volumen: "Bajar volumen",
  deload: "Descarga (deload)",
  reevaluar_rm: "Reevaluar RM",
  revisar_disponibilidad: "Revisar disponibilidad",
};

const TIPO_TONE: Record<string, string> = {
  subir_carga: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-950/30",
  bajar_carga: "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30",
  deload: "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30",
  revisar_disponibilidad: "border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-950/30",
};

function formatFecha(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function AjusteCard({
  ajuste,
  resuelto,
  onResuelto,
}: {
  ajuste: Ajuste;
  resuelto: Resolucion | null;
  onResuelto: (estado: Resolucion) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resolver(accion: "aceptar" | "rechazar") {
    setError(null);
    startTransition(async () => {
      const resultado =
        accion === "aceptar"
          ? await aceptarAjusteAction(ajuste.id, ajuste.personaId)
          : await rechazarAjusteAction(ajuste.id, ajuste.personaId);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onResuelto(accion === "aceptar" ? "aceptado" : "rechazado");
      router.refresh();
    });
  }

  if (resuelto) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm text-text-secondary dark:border-white/10">
        {resuelto === "aceptado" ? "Aceptado." : "Rechazado."}
      </div>
    );
  }

  return (
    <article
      className={[
        "space-y-3 rounded-2xl border p-4",
        TIPO_TONE[ajuste.tipo] ?? "border-gray-200 bg-bg-soft dark:border-white/10",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary dark:text-white">
          {TIPO_LABEL[ajuste.tipo] ?? ajuste.tipo}
          {ajuste.magnitud !== null ? ` · ${ajuste.magnitud}%` : ""}
        </p>
        <p className="text-xs text-text-tertiary">{formatFecha(ajuste.createdAt)}</p>
      </div>

      <p className="text-sm text-text-secondary">{ajuste.justificacion}</p>

      <details className="text-xs text-text-tertiary">
        <summary className="cursor-pointer">Ver evidencia</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-bg-main p-3 dark:bg-bg-subtle">
          {JSON.stringify(ajuste.evidencia, null, 2)}
        </pre>
      </details>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => resolver("aceptar")}
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-transparent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => resolver("rechazar")}
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white"
        >
          Rechazar
        </button>
      </div>
    </article>
  );
}

export function AjustesList({ ajustes }: { ajustes: Ajuste[] }) {
  // Congelamos la lista recibida al montar: aceptar/rechazar dispara
  // router.refresh(), que vuelve a pedir solo los ajustes aún "pendiente"
  // al servidor — sin esto, la tarjeta que acaba de resolverse desaparece
  // de `ajustes` en el siguiente render (ya no es pendiente) y se
  // desmonta antes de que se alcance a ver "Aceptado."/"Rechazado.".
  const [itemsVistos] = useState(ajustes);
  const [resueltos, setResueltos] = useState<Record<number, Resolucion>>({});

  if (itemsVistos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-bg-soft px-4 py-6 text-center text-sm text-text-secondary dark:border-white/10">
        No hay ajustes pendientes en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {itemsVistos.map((ajuste) => (
        <AjusteCard
          key={ajuste.id}
          ajuste={ajuste}
          resuelto={resueltos[ajuste.id] ?? null}
          onResuelto={(estado) =>
            setResueltos((prev) => ({ ...prev, [ajuste.id]: estado }))
          }
        />
      ))}
    </div>
  );
}
