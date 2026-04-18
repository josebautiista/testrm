"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: ReactNode;
};

export function FormSubmitButton({
  children,
  pendingLabel,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </PrimaryButton>
  );
}
