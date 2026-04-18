import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = {
  children: ReactNode;
  href?: string;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const baseClassName =
  "inline-flex w-full items-center justify-center rounded-xl border border-white/6 bg-bg-soft px-4 py-3 text-base font-medium tracking-tight text-white transition duration-200 active:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60";

export function PrimaryButton({
  children,
  href,
  className,
  ...props
}: PrimaryButtonProps) {
  const composedClassName = [baseClassName, className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={composedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={composedClassName}>
      {children}
    </button>
  );
}
