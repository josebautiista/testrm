"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  isUserLevel,
  resolveUserLevel,
  type UserLevel,
} from "@/lib/user-level";

export const USER_LEVEL_OVERRIDE_KEY = "user_level_override";
export const USER_LEVEL_OVERRIDE_EVENT = "user-level-override-change";

type UserLevelSelectorProps = {
  autoLevel: UserLevel;
  onResolvedLevelChange?: (level: UserLevel) => void;
};

type SelectorValue = "auto" | UserLevel;

const options: Array<{ value: SelectorValue; label: string }> = [
  { value: "auto", label: "Automático" },
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

function readOverrideLevel(): UserLevel | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedLevel = window.localStorage.getItem(USER_LEVEL_OVERRIDE_KEY);
  return isUserLevel(storedLevel) ? storedLevel : null;
}

export function UserLevelSelector({
  autoLevel,
  onResolvedLevelChange,
}: UserLevelSelectorProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<SelectorValue>(
    () => readOverrideLevel() ?? "auto",
  );
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const overrideLevel = isUserLevel(value) ? value : null;
    onResolvedLevelChange?.(resolveUserLevel(autoLevel, overrideLevel));
  }, [autoLevel, onResolvedLevelChange, value]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  function selectLevel(nextValue: SelectorValue) {
    const overrideLevel = isUserLevel(nextValue) ? nextValue : null;

    setValue(nextValue);
    setIsOpen(false);

    if (overrideLevel) {
      window.localStorage.setItem(USER_LEVEL_OVERRIDE_KEY, overrideLevel);
    } else {
      window.localStorage.removeItem(USER_LEVEL_OVERRIDE_KEY);
    }

    window.dispatchEvent(
      new CustomEvent(USER_LEVEL_OVERRIDE_EVENT, {
        detail: { level: overrideLevel },
      }),
    );

    onResolvedLevelChange?.(resolveUserLevel(autoLevel, overrideLevel));
  }

  return (
    <div ref={rootRef} className="relative space-y-1">
      <span id={`${listboxId}-label`} className="block text-xs font-medium uppercase tracking-wide text-text-tertiary">
        Ajustar nivel
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label ${listboxId}-value`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-full items-center justify-between rounded-2xl border border-gray-200 bg-bg-main px-4 text-left text-sm font-medium text-text-primary shadow-sm outline-none transition-colors hover:border-accent/60 focus:border-accent dark:border-white/10 dark:bg-bg-soft dark:text-white"
      >
        <span id={`${listboxId}-value`}>{selectedOption.label}</span>
        <span
          className={[
            "h-2 w-2 rotate-45 border-b border-r border-text-tertiary transition-transform",
            isOpen ? "-translate-y-px rotate-[225deg]" : "-translate-y-1",
          ].join(" ")}
        />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          id={listboxId}
          aria-labelledby={`${listboxId}-label`}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-bg-main p-1 shadow-lg dark:border-white/10 dark:bg-bg-soft"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectLevel(option.value)}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-bg-subtle font-semibold text-text-primary dark:text-white"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary dark:hover:text-white",
                ].join(" ")}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
