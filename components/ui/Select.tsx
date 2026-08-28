"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

type PanelPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const PANEL_ESTIMATED_HEIGHT = 260;

// Listbox custom (botón + panel propio), no un <select> nativo reskinneado
// — el popup nativo del sistema operativo no se puede estilar, así que para
// un look consistente (a la HeroUI) hace falta controlar también las
// opciones abiertas. Sigue el patrón de SearchableSelect (portal + posición
// calculada) para que el panel no quede recortado por contenedores con
// overflow-hidden (p. ej. las <section> del panel admin). `name` (sin
// onChange) renderiza un <input type="hidden"> para participar en FormData
// dentro de <form action={serverAction}> sin estado de React.
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  required,
  placeholder = "Seleccionar...",
  ariaLabel,
  className = "",
}: SelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const currentValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find((option) => option.value === currentValue);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward =
      spaceBelow < PANEL_ESTIMATED_HEIGHT && rect.top > spaceBelow;

    setPosition(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width },
    );
  }

  function close() {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function selectOption(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    close();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((index) =>
        event.key === "ArrowDown"
          ? Math.min(index + 1, options.length - 1)
          : Math.max(index - 1, 0),
      );
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        const option = options[highlightedIndex];
        if (option) selectOption(option.value);
      } else {
        setIsOpen(true);
      }
    } else if (event.key === "Escape") {
      close();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {name ? (
        <input type="hidden" name={name} value={currentValue} required={required} />
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => {
          if (!isOpen) {
            setHighlightedIndex(
              Math.max(
                options.findIndex((o) => o.value === currentValue),
                0,
              ),
            );
          }
          setIsOpen((open) => !open);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-2xl border border-transparent bg-gray-50 px-4 py-4 text-left text-base text-gray-900 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.25)] outline-none transition-shadow duration-200 focus:shadow-[inset_0_0_0_2px_rgba(30,41,59,0.45)] dark:border dark:border-white/6 dark:bg-bg-main dark:text-white dark:focus:border-accent",
          className,
        ].join(" ")}
      >
        <span className={selectedOption ? "truncate" : "truncate text-text-tertiary"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            "h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && position
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: "fixed",
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
              }}
              role="listbox"
              id={listboxId}
              aria-label={ariaLabel}
              className="z-50 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 bg-bg-main p-1 shadow-lg dark:border-white/10 dark:bg-bg-soft"
            >
              {options.map((option, index) => {
                const isSelected = option.value === currentValue;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOption(option.value)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      isHighlighted ? "bg-bg-subtle" : "",
                      isSelected
                        ? "font-semibold text-text-primary dark:text-white"
                        : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary dark:hover:text-white",
                    ].join(" ")}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
