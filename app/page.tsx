import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthUserFromCookies } from "@/lib/auth";

type IconProps = { className?: string };

function IconGauge({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 12 17 7" />
      <path d="M12 3v2" />
      <path d="M3 12h2" />
    </svg>
  );
}

function IconCalendar({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function IconClipboardCheck({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6h-8V4.5a1 1 0 0 1 1-1Z" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

function IconSliders({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 21V10" />
      <path d="M5 6V3" />
      <path d="M12 21v-7" />
      <path d="M12 10V3" />
      <path d="M19 21v-4" />
      <path d="M19 13V3" />
      <circle cx="5" cy="13" r="2" />
      <circle cx="12" cy="13" r="2" />
      <circle cx="19" cy="16" r="2" />
    </svg>
  );
}

function IconHistory({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function IconFlask({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}

const FORMULAS = [
  "Epley",
  "Brzycki",
  "Lombardi",
  "Lander",
  "O'Connor",
  "Mayhew",
  "Wathen",
  "Baechle",
];

const FEATURES = [
  {
    icon: IconGauge,
    title: "1RM con 8 fórmulas",
    desc: "Epley como fórmula principal, acompañada por un nivel de confianza según la calidad del intento.",
  },
  {
    icon: IconCalendar,
    title: "Periodización automática",
    desc: "Macrociclo, mesociclos y semanas generados según el objetivo y el tiempo disponible del atleta.",
  },
  {
    icon: IconClipboardCheck,
    title: "Ejecución real",
    desc: "Registra cada serie del entrenamiento y compara lo planificado contra lo que realmente pasó.",
  },
  {
    icon: IconSliders,
    title: "Autorregulación con criterio",
    desc: "El sistema propone ajustes de carga con su evidencia; el entrenador decide, nunca se aplican solos.",
  },
  {
    icon: IconHistory,
    title: "Historial que no se reescribe",
    desc: "Cada nueva medición abre un registro nuevo — el histórico de cada atleta queda intacto.",
  },
  {
    icon: IconFlask,
    title: "Protocolos de laboratorio",
    desc: "Casas y Naclerio disponibles para atletas con más experiencia de entrenamiento.",
  },
];

const PASOS = [
  {
    numero: "1",
    titulo: "Evalúa el 1RM",
    desc: "Por ejercicio, con la fórmula y la fecha que respaldan cada carga.",
  },
  {
    numero: "2",
    titulo: "Genera el macrociclo",
    desc: "El motor propone semanas, volumen e intensidad según el objetivo.",
  },
  {
    numero: "3",
    titulo: "Registra la ejecución",
    desc: "Cada sesión, cada serie — lo planificado frente a lo ejecutado.",
  },
  {
    numero: "4",
    titulo: "Decide los ajustes",
    desc: "El sistema avisa cuándo subir, bajar o descargar; tú confirmas.",
  },
];

export default async function HomePage() {
  const authUser = await getAuthUserFromCookies();
  if (authUser) {
    redirect(authUser.role === "admin" ? "/admin" : "/atletas");
  }

  return (
    <main className="space-y-16 py-10 sm:space-y-20">
      {/* Hero */}
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-bg-soft px-4 py-2 text-sm font-semibold text-text-secondary dark:border-white/10">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
            Ciencia del 1RM, no adivinanza
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl dark:text-white">
            Deja de adivinar cargas: mide el 1RM real de cada atleta.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-text-secondary">
            Evalúa la fuerza máxima con 8 fórmulas reconocidas, cada una con
            su rango de confianza. A partir de ahí generamos el macrociclo,
            prescribimos cada sesión y ajustamos la carga según lo que tu
            atleta realmente ejecuta.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-8 py-4 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.85)] transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Iniciar sesión
            </Link>
            <a
              href="#el-test-de-1rm"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-bg-soft px-8 py-4 text-sm font-semibold text-text-primary transition hover:bg-bg-subtle dark:border-white/10 dark:text-white"
            >
              Cómo funciona el test
            </a>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.35)] dark:border-white/10">
          <Image
            src="https://images.unsplash.com/photo-1683889843123-5eca2abfd882?auto=format&fit=crop&w=1200&q=80"
            alt="Disco y barra de una barbell en un gimnasio"
            width={1200}
            height={900}
            priority
            className="h-full w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
        </div>
      </section>

      {/* El test de 1RM, con evidencia */}
      <section
        id="el-test-de-1rm"
        className="grid gap-10 rounded-[2rem] border border-gray-200 bg-bg-soft p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center dark:border-white/10"
      >
        <div className="relative order-2 overflow-hidden rounded-[1.5rem] lg:order-1">
          <Image
            src="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1000&q=80"
            alt="Atleta preparando un levantamiento con muñequeras de agarre"
            width={1000}
            height={1000}
            className="h-full w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 480px"
          />
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            El test de 1RM
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary dark:text-white">
            Un solo número nunca cuenta toda la historia.
          </h2>
          <p className="leading-7 text-text-secondary">
            Cada test corre las 8 fórmulas a la vez y guarda la estimación
            primaria junto con el rango completo (mínimo–máximo) y un nivel
            de confianza. Si las repeticiones se salen del rango válido, la
            app lo marca en vez de darte un dato poco confiable.
          </p>
          <p className="leading-7 text-text-secondary">
            Para atletas con más experiencia, los protocolos de laboratorio
            Casas y Naclerio miden con carga real en vez de estimar. Y cada
            vez que el RM cambia, el anterior no se sobrescribe — queda
            archivado, así que ninguna prescripción pasada cambia
            retroactivamente.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {FORMULAS.map((formula) => (
              <span
                key={formula}
                className="rounded-full border border-gray-200 bg-bg-main px-3 py-1 text-xs font-medium text-text-secondary dark:border-white/10"
              >
                {formula}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="space-y-8">
        <div className="max-w-xl space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary dark:text-white">
            Todo el ciclo, en un solo lugar.
          </h2>
          <p className="text-text-secondary">
            Evaluación, prescripción y ejecución conectadas — cada carga que
            ves tiene un test y una fecha que la respaldan.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="space-y-3 rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/10"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <feature.icon className="h-5 w-5" />
              </span>
              <p className="font-semibold text-text-primary dark:text-white">
                {feature.title}
              </p>
              <p className="text-sm leading-6 text-text-secondary">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="space-y-8">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary dark:text-white">
          Flujo de trabajo del entrenador
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso) => (
            <div
              key={paso.numero}
              className="space-y-2 rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {paso.numero}
              </span>
              <p className="font-semibold text-text-primary dark:text-white">
                {paso.titulo}
              </p>
              <p className="text-sm leading-6 text-text-secondary">
                {paso.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Banner de cierre */}
      <section className="relative overflow-hidden rounded-[2rem] border border-gray-200 dark:border-white/10">
        <Image
          src="https://images.unsplash.com/photo-1584863231364-2edc166de576?auto=format&fit=crop&w=1600&q=80"
          alt="Atleta levantando peso en un gimnasio equipado"
          width={1600}
          height={700}
          className="h-64 w-full object-cover sm:h-80"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 sm:p-10">
          <p className="max-w-lg text-xl font-semibold text-white sm:text-2xl">
            Para el entrenador que maneja varios atletas y no quiere perder
            de vista a ninguno.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>
    </main>
  );
}
