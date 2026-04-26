import { type ButtonHTMLAttributes } from "react";

type AdminButtonVariant = "primary" | "danger" | "ghost";
type AdminButtonSize = "sm" | "md";

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
};

export function AdminButton({
  className = "",
  variant = "primary",
  size = "sm",
  disabled,
  children,
  ...props
}: AdminButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 select-none";

  const sizes: Record<AdminButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  // Use CSS vars so the button adapts automatically to any theme
  const variants: Record<AdminButtonVariant, string> = {
    primary:
      "bg-text-primary text-bg-main hover:opacity-80 dark:bg-white dark:text-black",
    danger:
      "bg-red-500/15 text-red-500 hover:bg-red-500/25 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30",
    ghost:
      "bg-bg-subtle text-text-secondary hover:bg-bg-subtle/80 border border-border-subtle",
  };

  return (
    <button
      {...props}
      disabled={disabled}
      className={[base, sizes[size], variants[variant], className].join(" ")}
    >
      {children}
    </button>
  );
}
