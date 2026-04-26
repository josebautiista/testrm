import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin1234";

const globalBootstrap = globalThis as unknown as {
  ensureAdminPromise?: Promise<void>;
};

async function createAdminIfMissing() {
  const existingAdmin = await prisma.user.findUnique({
    where: {
      username: DEFAULT_ADMIN_USERNAME,
    },
    select: {
      id: true,
    },
  });

  if (existingAdmin) {
    return;
  }

  const password = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.user.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      password,
    },
  });
}

export function ensureDefaultAdminUser() {
  if (!globalBootstrap.ensureAdminPromise) {
    globalBootstrap.ensureAdminPromise = createAdminIfMissing().catch(
      (error) => {
        console.error("Failed to ensure default admin user", error);
        globalBootstrap.ensureAdminPromise = undefined;
      },
    );
  }

  return globalBootstrap.ensureAdminPromise;
}
