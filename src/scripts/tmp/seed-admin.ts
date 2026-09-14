import { prisma } from "../../helper/prisma";
import { hashPassword } from "../../helper/hashPassword";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "admin@tegat.test" },
    update: {},
    create: {
      first_name: "Root",
      last_name: "Admin",
      email: "admin@tegat.test",
      password: await hashPassword("Admin#Test123"),
      role: "ADMIN",
      has_validated_email: true,
      terms_accepted_at: new Date(),
      admin_profile: { create: { admin_role: "SUPER_ADMIN" } },
    },
    select: { id: true, email: true, admin_profile: true },
  });
  console.log(JSON.stringify(user, null, 1));
  await prisma.$disconnect();
}
main();
