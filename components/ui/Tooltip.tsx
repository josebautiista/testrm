"use client";

import { useRef, useState } from "react";

type TooltipProps = {
  text: string;
};

export function Tooltip({ text }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 120);
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Información del campo"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setVisible((v) => !v)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none text-text-tertiary transition-colors hover:border-text-secondary hover:text-text-secondary focus:outline-none dark:text-white/40 dark:hover:border-white/60 dark:hover:text-white/60"
      >
        ?
      </button>

      {visible && (
        <span
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-text-secondary shadow-lg dark:border-white/10 dark:bg-neutral-800 dark:text-white/70"
        >
          {text}
          {/* small arrow */}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-200 dark:border-t-white/10" />
          <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-px border-4 border-transparent border-t-white dark:border-t-neutral-800" />
        </span>
      )}
    </span>
  );
}
