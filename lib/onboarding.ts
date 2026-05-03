"use client";

export function hasSeenTour(key: string) {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(key);
}

export function markSeenTour(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, "1");
}

export function resetSeenTour(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

type DriverStep = {
  element?: string | Element | null;
  popover?: {
    title?: string;
    description?: string;
    position?: string;
  };
};

async function ensureDriver() {
  if (typeof window === "undefined") return null;

  const mod = await import("driver.js");
  const Driver = (mod && (mod as any).default) || mod;

  return Driver;
}

export async function startDriver(
  steps: DriverStep[],
  options: Record<string, any> = {},
) {
  if (typeof window === "undefined") return;
  try {
    const Driver = await ensureDriver();
    if (!Driver) return;
    const driver = new (Driver as any)(
      Object.assign(
        {
          opacity: 0.6,
          padding: 12,
          allowClose: true,
          closable: true,
          doneBtnText: "Finalizar",
          closeBtnText: "Cerrar",
          nextBtnText: "Siguiente",
          prevBtnText: "Anterior",
          className: "driver-highlight",
        },
        options,
      ),
    );

    // Convert our steps to driver format if needed
    const dSteps = steps.map((s: any) => {
      const element = s.element ?? s.selector ?? null;
      return {
        element,
        popover: {
          title: s.popover?.title,
          description: s.popover?.description,
          position: s.popover?.position || "bottom",
        },
      };
    });

    driver.defineSteps(dSteps);
    driver.start();
    return driver;
  } catch (err) {
    // fail silently
    // console.error('driver start error', err);
    return null;
  }
}

export async function startDashboardTour(hasSessions: boolean) {
  const steps: DriverStep[] = [
    {
      element: "body",
      popover: {
        title: "Bienvenido",
        description:
          "Bienvenido a tu tablero. Te mostraré las partes importantes para empezar.",
        position: "center",
      },
    },
    {
      element: ".dashboard-sessions-list",
      popover: {
        title: "Tus sesiones",
        description: hasSessions
          ? "Aquí verás tus sesiones guardadas y tu progreso de fuerza."
          : "Registra hoy tu primera sesión y empieza a comparar resultados.",
        position: "top",
      },
    },
    {
      element: ".dashboard-new-session-btn",
      popover: {
        title: "Crear sesión",
        description:
          "Aquí puedes crear una nueva sesión para registrar tus repeticiones y ver resultados como el 1RM.",
        position: "bottom",
      },
    },
    {
      element: "[data-tour='imc-card']",
      popover: {
        title: "IMC",
        description:
          "Aquí puedes ver tu índice de masa corporal (IMC), que te ayuda a entender tu estado físico.",
        position: "right",
      },
    },
    {
      element: "[data-tour='icc-section']",
      popover: {
        title: "ICC",
        description:
          "El índice cintura-cadera (ICC) te da información adicional sobre distribución de grasa corporal.",
        position: "left",
      },
    },
  ];

  const driver = await startDriver(steps);
  if (driver) markSeenTour("dashboard-tour-seen");
  return driver;
}

export async function startNuevaSesionTour() {
  const steps: DriverStep[] = [
    {
      element: "body",
      popover: {
        title: "Bienvenido",
        description:
          "Te guiaré por el formulario para registrar una sesión correctamente.",
        position: "center",
      },
    },
    {
      element: ".session-weight-field",
      popover: {
        title: "Peso actual",
        description:
          "Registra tu peso actual para ajustar las fórmulas que estiman tu 1RM.",
        position: "bottom",
      },
    },
    {
      element: ".session-reps-field",
      popover: {
        title: "Repeticiones",
        description: "Indica cuántas repeticiones realizaste por ejercicio.",
        position: "top",
      },
    },
    {
      element: ".session-save-button",
      popover: {
        title: "Guardar sesión",
        description:
          "Guarda la sesión y verás tus resultados estimados al instante.",
        position: "top",
      },
    },
  ];

  const driver = await startDriver(steps);
  if (driver) markSeenTour("nueva-sesion-tour-seen");
  return driver;
}
