"use client";

import { useCallback, useEffect, useState } from "react";

export function WizardScrollControls() {
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);

  const updateVisibility = useCallback(() => {
    const documentHeight = document.documentElement.scrollHeight;
    const viewportBottom = window.scrollY + window.innerHeight;
    const hasScrollableContent = documentHeight > window.innerHeight + 80;

    setShowUp(window.scrollY > 160);
    setShowDown(hasScrollableContent && viewportBottom < documentHeight - 80);
  }, []);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(updateVisibility);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    const observer = new ResizeObserver(updateVisibility);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
    };
  }, [updateVisibility]);

  if (!showUp && !showDown) return null;

  return (
    <nav
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
      aria-label="Navegación vertical del wizard"
    >
      {showUp ? (
        <ScrollButton
          label="Ir al inicio del paso"
          direction="up"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        />
      ) : null}
      {showDown ? (
        <ScrollButton
          label="Ir al final del paso"
          direction="down"
          onClick={() =>
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            })
          }
        />
      ) : null}
    </nav>
  );
}

function ScrollButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: "up" | "down";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center rounded-full border border-accent/30 bg-bg-main text-accent shadow-xl transition hover:-translate-y-0.5 hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:bg-bg-soft dark:hover:bg-bg-subtle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        {direction === "up" ? (
          <path d="m6 15 6-6 6 6" />
        ) : (
          <path d="m6 9 6 6 6-6" />
        )}
      </svg>
    </button>
  );
}
