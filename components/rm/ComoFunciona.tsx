import { ReactNode } from "react";

type Paso = {
  titulo: string;
  detalle: string;
};

type Props = {
  titulo: string;
  resumen: string;
  pasos?: Paso[];
  /** Por qué el test está diseñado así. Es lo que evita que el atleta "optimice" el número. */
  porQue?: string;
  /** Referencia bibliográfica o nota de origen, si la hay. */
  fuente?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
};

/**
 * Panel "cómo funciona" que acompaña a cada método de evaluación de RM.
 *
 * El test de RM no es autoexplicativo: si el atleta no entiende que las
 * repeticiones deben quedar en una ventana concreta, o que un intento fallido
 * también hay que registrarlo, el dato que entra es basura y ninguna fórmula
 * lo arregla después. Por eso la explicación va en la vista, no en un manual.
 */
export function ComoFunciona({
  titulo,
  resumen,
  pasos,
  porQue,
  fuente,
  children,
  defaultOpen = true,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-gray-200 bg-bg-soft dark:border-white/10 dark:bg-bg-subtle"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent"
          >
            ?
          </span>
          <span className="text-sm font-semibold text-text-primary dark:text-white">
            {titulo}
          </span>
        </span>
        <span className="text-xs font-medium text-text-tertiary transition group-open:hidden">
          Ver
        </span>
        <span className="hidden text-xs font-medium text-text-tertiary group-open:inline">
          Ocultar
        </span>
      </summary>

      <div className="space-y-4 border-t border-gray-200 px-4 py-4 dark:border-white/10">
        <p className="text-sm leading-6 text-text-secondary">{resumen}</p>

        {pasos && pasos.length > 0 ? (
          <ol className="space-y-2">
            {pasos.map((paso, indice) => (
              <li key={paso.titulo} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-gray-300 text-[11px] font-semibold tabular-nums text-text-secondary dark:border-white/20">
                  {indice + 1}
                </span>
                <span className="text-sm leading-6">
                  <span className="font-semibold text-text-primary dark:text-white">
                    {paso.titulo}.
                  </span>{" "}
                  <span className="text-text-secondary">{paso.detalle}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {children}

        {porQue ? (
          <p className="rounded-xl border border-gray-200 bg-bg-main px-3 py-2.5 text-sm leading-6 text-text-secondary dark:border-white/10 dark:bg-bg-main">
            <span className="font-semibold text-text-primary dark:text-white">
              Por qué es así:
            </span>{" "}
            {porQue}
          </p>
        ) : null}

        {fuente ? (
          <p className="text-xs leading-5 text-text-tertiary">{fuente}</p>
        ) : null}
      </div>
    </details>
  );
}

type AvisoProps = {
  tono: "info" | "exito" | "alerta" | "error";
  children: ReactNode;
  titulo?: string;
};

const TONOS: Record<AvisoProps["tono"], string> = {
  info: "border-gray-200 bg-bg-soft text-text-secondary dark:border-white/10 dark:bg-bg-subtle",
  exito:
    "border-accent/30 bg-accent/10 text-text-secondary dark:border-accent/25 dark:bg-accent/10",
  alerta:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-200",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-950/30 dark:text-red-200",
};

/** Aviso en línea con el mismo lenguaje visual en todos los pasos del test. */
export function Aviso({ tono, titulo, children }: AvisoProps) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        TONOS[tono],
      ].join(" ")}
    >
      {titulo ? (
        <p className="font-semibold text-text-primary dark:text-white">
          {titulo}
        </p>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
