"use server";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";
import { Resend } from "resend";

type SendAdminOtpState = {
  success: boolean;
  sent: boolean;
  error: string | null;
};

function normalizeRequestId(value: string) {
  return value.trim();
}

function parseRequestId(formData: FormData) {
  const requestId = normalizeRequestId(
    typeof formData.get("requestId") === "string"
      ? (formData.get("requestId") as string)
      : "",
  );

  return requestId || null;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAdminOtp(
  _prevState: SendAdminOtpState,
  formData: FormData,
): Promise<SendAdminOtpState> {
  const requestId = parseRequestId(formData);

  if (!requestId) {
    return {
      success: false,
      sent: false,
      error: "No fue posible preparar el envio del codigo.",
    };
  }

  const adminEmail = process.env.ADMIN_EMAILS?.trim();

  if (!process.env.RESEND_API_KEY || !adminEmail) {
    return {
      success: false,
      sent: false,
      error: "Configuracion de admin incompleta.",
    };
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);

  const requestCount = await prisma.adminOtp.count({
    where: {
      createdAt: {
        gte: oneMinuteAgo,
      },
    },
  });

  if (requestCount >= 3) {
    return {
      success: false,
      sent: false,
      error: "Espera un minuto antes de solicitar otro codigo.",
    };
  }

  await prisma.adminOtp.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(now.getTime() + 5 * 60_000);

  try {
    await prisma.adminOtp.create({
      data: {
        requestId,
        code,
        expiresAt,
        used: false,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: true,
        sent: true,
        error: null,
      };
    }

    throw error;
  }

  try {
    await resend.emails.send({
      from: "Admin <onboarding@resend.dev>",
      to: [adminEmail],
      subject: "Admin Access Code",
      html: `<strong>Your OTP is: ${code}</strong><br/>Expires in 5 minutes`,
    });

    return {
      success: true,
      sent: true,
      error: null,
    };
  } catch {
    await prisma.adminOtp.deleteMany({
      where: {
        requestId,
      },
    });

    return {
      success: false,
      sent: false,
      error: "No fue posible enviar el codigo.",
    };
  }
}
