import { prisma } from "../../helper/prisma";

async function main() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true, account_status: true, has_validated_email: true, admin_profile: true } });
  console.log(JSON.stringify(admins, null, 1));
  await prisma.$disconnect();
}
main();
