"use client";

import { Tooltip } from "@/components/ui/Tooltip";

type InfoTooltipProps = {
  text: string;
  className?: string;
};

export default function InfoTooltip({
  text,
  className = "",
}: InfoTooltipProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Tooltip text={text} />
    </span>
  );
}
