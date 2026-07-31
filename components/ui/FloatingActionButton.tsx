"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { iniciarMacrocicloAction } from "@/actions/macrociclo";

type FloatingActionButtonProps = {
  cc: string;
  macrocicloAbiertoId?: number;
  macrocicloAbiertoEstado?: string;
};

export function FloatingActionButton({
  cc,
  macrocicloAbiertoId,
  macrocicloAbiertoEstado,
}: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const newSessionHref = `/nueva-sesion?cc=${encodeURIComponent(cc)}`;
  const macrocicloHref = macrocicloAbiertoId
    ? macrocicloAbiertoEstado === "borrador"
      ? `/macrociclo/${macrocicloAbiertoId}/editar?cc=${encodeURIComponent(cc)}`
      : `/macrociclo/${macrocicloAbiertoId}?cc=${encodeURIComponent(cc)}`
    : undefined;

  const menuItemClass =
    "block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-text-primary transition hover:bg-bg-subtle dark:text-white";

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="mb-2 flex w-56 flex-col gap-1 rounded-2xl border border-gray-200 bg-bg-soft p-2 shadow-sm dark:border-white/6 dark:bg-bg-subtle">
          {macrocicloHref ? (
            <Link href={macrocicloHref} className={menuItemClass} onClick={() => setOpen(false)}>
              {macrocicloAbiertoEstado === "borrador" ? (
                <>
                  Continuar macrociclo
                  <span className="ml-2 text-xs text-text-tertiary">(borrador)</span>
                </>
              ) : (
                "Ver macrociclo"
              )}
            </Link>
          ) : (
            <form action={iniciarMacrocicloAction}>
              <input type="hidden" name="cc" value={cc} />
              <button type="submit" className={menuItemClass}>
                Crear macrociclo
              </button>
            </form>
          )}
          <Link href={newSessionHref} className={menuItemClass} onClick={() => setOpen(false)}>
            Crear sesión de RM
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Abrir menú de acciones"
        aria-expanded={open}
        className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-bg-soft text-xl font-medium text-text-primary shadow-sm transition duration-200 hover:bg-bg-subtle active:bg-bg-subtle dark:border-white/6 dark:text-white dark:shadow-none"
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
