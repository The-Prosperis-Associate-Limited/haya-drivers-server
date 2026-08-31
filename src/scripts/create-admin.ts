import "dotenv/config";
import { AuthRegistrationService } from "../services/auth/auth.registration.service";
import { prisma } from "../helper/prisma";

// Usage: npx tsx src/scripts/create-admin.ts "Full Name" admin@tegat.com "Password1!"
const run = async () => {
  const [full_name, email, password] = process.argv.slice(2);

  if (!full_name || !email || !password) {
    console.error("Usage: tsx src/scripts/create-admin.ts <full_name> <email> <password>");
    process.exit(1);
  }

  const registrationService = new AuthRegistrationService();

  const admin = await registrationService.createAdmin({
    full_name,
    email,
    password,
    role: "CLIENT",
    accepted_terms: true,
    client: "web",
  });

  console.log(`✅ Admin created: ${admin.email}`);

  await prisma.$disconnect();
};

run().catch(async error => {
  console.error("❌ Failed to create admin:", error);
  await prisma.$disconnect();
  process.exit(1);
});
