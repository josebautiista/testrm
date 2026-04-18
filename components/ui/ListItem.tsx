import Link from "next/link";
import { ReactNode } from "react";

type ListItemProps = {
  children: ReactNode;
  href?: string;
  rightSlot?: ReactNode;
  withDivider?: boolean;
};

export function ListItem({
  children,
  href,
  rightSlot,
  withDivider = true,
}: ListItemProps) {
  const className = [
    "flex w-full items-center justify-between gap-3 py-3 text-left text-base text-white transition duration-200",
    "active:bg-bg-subtle",
    withDivider ? "border-b border-white/6" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={className}>
        <span>{children}</span>
        {rightSlot ?? <span className="text-text-tertiary">›</span>}
      </Link>
    );
  }

  return (
    <div className={className}>
      <span>{children}</span>
      {rightSlot}
    </div>
  );
}
