import { type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "w-full rounded-2xl px-5 py-4 text-sm font-semibold tracking-wide transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "bg-gray-900 text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.85)] hover:bg-gray-800",
        "dark:bg-white dark:text-black dark:shadow-none dark:hover:bg-white/90",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
