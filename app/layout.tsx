import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppThemeToggle } from "../components/ui/AppThemeToggle";
import { ensureDefaultAdminUser } from "@/lib/bootstrap";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Entrena tu fuerza",
  description: "Registro simple de sesiones y progreso de fuerza",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  void ensureDefaultAdminUser();

  return (
    <html lang="es" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full bg-white font-sans text-gray-900 selection:bg-accent/25 dark:bg-bg-main dark:text-white">
        <div className="pointer-events-none fixed inset-x-0 top-5 z-50">
          <div className="pointer-events-auto mx-auto flex w-full max-w-105 items-center justify-between px-4 lg:max-w-6xl">
            <div aria-hidden="true" className="h-10 w-10" />
            <AppThemeToggle />
          </div>
        </div>
        <div className="mx-auto min-h-screen w-full max-w-105 px-4 py-6 lg:max-w-6xl">
          {children}
        </div>
      </body>
    </html>
  );
}
