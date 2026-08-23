"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
};

type PanelPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const PANEL_ESTIMATED_HEIGHT = 300;

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function SearchableSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: SearchableSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = normalizeText(query.trim());
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        normalizeText(option.label).includes(normalizedQuery),
      )
    : options;

  function close() {
    setIsOpen(false);
    setQuery("");
  }

  function selectOption(optionValue: string) {
    onChange(optionValue);
    close();
  }

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward =
      spaceBelow < PANEL_ESTIMATED_HEIGHT && rect.top > spaceBelow;

    setPosition(
      openUpward
        ? {
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
          }
        : {
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          },
    );
  }

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    searchRef.current?.focus();

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

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        Math.min(index + 1, filteredOptions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        selectOption(option.value);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-left text-sm text-text-primary outline-none transition-colors focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
      >
        <span className="truncate">
          {selectedOption?.label ?? "Seleccionar..."}
        </span>
        <span
          className={[
            "h-2 w-2 shrink-0 rotate-45 border-b border-r border-text-tertiary transition-transform",
            isOpen ? "rotate-[225deg]" : "",
          ].join(" ")}
        />
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
              className="z-50 overflow-hidden rounded-xl border border-gray-200 bg-bg-main shadow-lg dark:border-white/10 dark:bg-bg-subtle"
            >
              <div className="border-b border-gray-200 p-2 dark:border-white/10">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar..."
                  className="w-full rounded-lg border border-gray-200 bg-bg-soft px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                />
              </div>
              <div
                role="listbox"
                id={listboxId}
                aria-label={ariaLabel}
                className="max-h-60 overflow-y-auto p-1"
              >
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-text-tertiary">
                    Sin resultados
                  </p>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = option.value === value;
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
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isHighlighted ? "bg-bg-soft dark:bg-bg-main" : "",
                          isSelected
                            ? "font-semibold text-text-primary dark:text-white"
                            : "text-text-secondary hover:text-text-primary dark:hover:text-white",
                        ].join(" ")}
                      >
                        <span>{option.label}</span>
                        {isSelected ? (
                          <span className="h-2 w-2 rounded-full bg-accent" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
