"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel,
  className,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </PrimaryButton>
  );
}
