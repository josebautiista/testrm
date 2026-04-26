"use client";

import { ReactNode, useEffect } from "react";

type ICCBottomSheetProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ICCBottomSheet({
  isOpen,
  title,
  onClose,
  children,
}: ICCBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <div
      className={[
        "fixed inset-0 z-50 transition-opacity duration-300",
        isOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      ].join(" ")}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        onPointerDown={onClose}
        onClick={(event) => {
          event.preventDefault();
        }}
        className={[
          "absolute inset-0 bg-black/65 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        aria-label="Cerrar panel"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className={[
          "absolute inset-x-0 bottom-0 max-h-[92vh] rounded-t-3xl border-t border-gray-200 bg-bg-main dark:border-white/10",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/20" />
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h3 className="text-base font-semibold tracking-tight text-text-primary dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-text-secondary dark:border-white/10"
          >
            Cerrar
          </button>
        </div>
        <div className="modal-scroll max-h-[calc(92vh-4.5rem)] overflow-y-auto px-4 pb-6">
          {children}
        </div>
      </section>
    </div>
  );
}
