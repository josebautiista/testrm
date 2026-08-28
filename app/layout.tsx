import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppHeader, PublicHeader } from "../components/layout/AppHeader";
import { NumberInputWheelGuard } from "../components/ui/NumberInputWheelGuard";
import { ThemeScript } from "../components/ui/ThemeScript";
import { ensureDefaultAdminUser } from "@/lib/bootstrap";
import { getAuthUserFromCookies } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Entrena tu fuerza",
  description: "Registro simple de sesiones y progreso de fuerza",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  void ensureDefaultAdminUser();
  const authUser = await getAuthUserFromCookies();

  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-white font-sans text-gray-900 selection:bg-accent/25 dark:bg-bg-main dark:text-white">
        {authUser ? (
          <AppHeader username={authUser.username} role={authUser.role} />
        ) : (
          <PublicHeader />
        )}
        {/* flex + flex-1 (no min-h-screen aquí): el header de arriba ya
            ocupa espacio real en el flujo, así que el contenido debe llenar
            lo que queda del viewport, no otro 100vh completo — si no,
            cualquier página hija que se centra verticalmente queda
            descentrada y con scroll de sobra. Es "flex flex-col" (no solo
            un div normal) para que una página hija pueda apoyarse en su
            propio "flex-1" y llenar justo ese alto disponible — un
            min-h-full ahí no resuelve de forma fiable contra un ancestro
            cuyo alto viene de flex-grow. */}
        <div className="mx-auto flex w-full max-w-105 flex-1 flex-col px-4 py-6 lg:max-w-6xl">
          {children}
        </div>
        <NumberInputWheelGuard />
      </body>
    </html>
  );
}
