import { type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-2xl px-4 py-4 text-base outline-none transition-shadow duration-200",
        "border border-transparent bg-gray-50 text-gray-900 placeholder:text-gray-400 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.25)] focus:shadow-[inset_0_0_0_1px_rgba(30,41,59,0.35)]",
        "dark:border dark:border-white/6 dark:bg-bg-main dark:text-white dark:placeholder:text-text-tertiary dark:focus:border-white/15 dark:shadow-none",
        className,
      ].join(" ")}
    />
  );
}
