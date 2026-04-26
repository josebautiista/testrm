type ThemeToggleProps = {
  isDark: boolean;
  onToggle: () => void;
};

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      className={[
        "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
        isDark
          ? "border border-white/10 bg-bg-soft text-white"
          : "bg-white text-gray-900 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.75)]",
      ].join(" ")}
    >
      {isDark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2" />
          <path d="M12 19.3v2.2" />
          <path d="M2.5 12h2.2" />
          <path d="M19.3 12h2.2" />
          <path d="M5.3 5.3l1.6 1.6" />
          <path d="M17.1 17.1l1.6 1.6" />
          <path d="M17.1 6.9l1.6-1.6" />
          <path d="M5.3 18.7l1.6-1.6" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.2A8 8 0 1 1 9.8 4 6.6 6.6 0 0 0 20 14.2z" />
        </svg>
      )}
    </button>
  );
}
