"use client";

import { useEffect } from "react";

export function NumberInputWheelGuard() {
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement &&
        target.type === "number" &&
        document.activeElement === target
      ) {
        target.blur();
      }
    }

    document.addEventListener("wheel", handleWheel);

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return null;
}
