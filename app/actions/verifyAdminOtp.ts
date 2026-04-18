"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

type VerifyAdminOtpState = {
  success: boolean;
  error: string | null;
};

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

export async function verifyAdminOtp(
  _prevState: VerifyAdminOtpState,
  formData: FormData,
): Promise<VerifyAdminOtpState> {
  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? rawCode.replace(/\D/g, "") : "";

  if (code.length !== 6) {
    return {
      success: false,
      error: "Codigo invalido.",
    };
  }

  const now = new Date();

  const otp = await prisma.adminOtp.findFirst({
    where: {
      code,
      used: false,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otp) {
    return {
      success: false,
      error: "Codigo invalido o expirado.",
    };
  }

  await prisma.adminOtp.update({
    where: {
      id: otp.id,
    },
    data: {
      used: true,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("admin_session", "true", {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60,
    path: "/",
  });

  redirect("/admin");
}
