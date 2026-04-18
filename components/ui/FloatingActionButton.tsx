import Link from "next/link";

type FloatingActionButtonProps = {
  href: string;
  label: string;
};

export function FloatingActionButton({
  href,
  label,
}: FloatingActionButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed bottom-5 right-5 z-20 inline-flex h-12 min-w-12 items-center justify-center rounded-xl border border-white/6 bg-bg-soft px-4 text-base font-medium tracking-tight text-white transition duration-200 active:bg-bg-subtle"
    >
      {label}
    </Link>
  );
}
