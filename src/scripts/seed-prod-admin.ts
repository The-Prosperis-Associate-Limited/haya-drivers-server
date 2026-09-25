import { prisma } from "../helper/prisma";
import { hashPassword } from "../helper/hashPassword";

// One-shot prod bootstrap, run from server.ts. Delete after the account exists.
export const seedProdAdmin = async function () {
  const email = "admin@driversvault.com";

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    console.log("👤 Prod admin already exists — seed skipped");
    return;
  }

  await prisma.user.create({
    data: {
      first_name: "DriversVault",
      last_name: "Admin",
      email,
      password: await hashPassword("Tester123##"),
      role: "ADMIN",
      has_validated_email: true,
      terms_accepted_at: new Date(),
      admin_profile: { create: { admin_role: "SUPER_ADMIN" } },
    },
  });

  console.log("👤 Prod admin created:", email);
};
