import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RM Gym",
  description: "Registro de sesiones de fuerza",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg-main font-sans text-white selection:bg-accent/25">
        <div className="mx-auto min-h-screen w-full max-w-105 px-4 py-6 lg:max-w-6xl">
          {children}
        </div>
      </body>
    </html>
  );
}
