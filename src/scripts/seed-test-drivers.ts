import type { $Enums, Prisma } from "../generated/prisma/client";
import { prisma } from "../helper/prisma";
import { generateProfessionalEmail } from "../utils/email/templates/generateProfessionalEmail";
import { transportMail } from "../utils/email/transportMail";
import { surfaceUrlFor } from "../utils/surfaceUrl";
import { generateRandomPassword, hashPassword } from "../helper/hashPassword";
import { WalletRepository } from "../repositories/earnings/wallet.repository";
import { ActivityService } from "../services/shared/activity.service";
import { TrustScoreService } from "../services/shared/trustScore.service";

interface SeedDriver {
  first_name: string;
  last_name: string;
  gender: $Enums.Gender;
  date_of_birth: string;
  marital_status: $Enums.MaritalStatus;
  state_of_residence: string;
  city: string;
  address: string;
  state_of_origin: string;
  driver_type: $Enums.DriverType;
  transmission: $Enums.Transmission;
  licence_classes: $Enums.LicenceClass[];
  years_of_experience: number;
  academic_level: $Enums.AcademicLevel;
  institution?: string;
  course_of_study?: string;
  languages: string[];
  religion: string;
  ethnicity: string;
  expected_monthly_rate_major: number | null;
  availability: { day_range: string; start: string; end: string }[] | null;
  bio: string;
  employer: string;
  job_title: string;
}

const EMAIL_DOMAIN = "hayadrivers.com";
const CREDENTIAL_RECIPIENTS = ["officialayo540@gmail.com", "prosperisassociates@gmail.com"];
const PLACEHOLDER_IMAGE = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const ALL_DOCUMENTS: $Enums.DocumentType[] = ["NIN_SLIP", "PASSPORT_PHOTO", "DRIVERS_LICENCE", "PROOF_OF_ADDRESS", "GUARANTOR_PASSPORT", "GUARANTOR_NIN_SLIP"];

const GUARANTOR_NAMES = ["Samuel Ogunleye", "Fatima Lawal", "John Okon", "Grace Effiong", "Yusuf Danjuma", "Chiamaka Obi"];

const WEEKDAYS = [{ day_range: "Mon - Fri", start: "8:00 AM", end: "6:00 PM" }];

const DRIVERS: SeedDriver[] = [
  {
    first_name: "Tunde",
    last_name: "Adebayo",
    gender: "MALE",
    date_of_birth: "1985-03-14",
    marital_status: "MARRIED",
    state_of_residence: "Lagos",
    city: "Ikeja",
    address: "14 Allen Avenue, Ikeja",
    state_of_origin: "Ogun",
    driver_type: "CORPORATE_DRIVER",
    transmission: "BOTH",
    licence_classes: ["B", "C"],
    years_of_experience: 12,
    academic_level: "HND",
    institution: "Yaba College of Technology",
    course_of_study: "Business Administration",
    languages: ["English", "Yoruba", "Pidgin"],
    religion: "CHRISTIANITY",
    ethnicity: "Yoruba",
    expected_monthly_rate_major: 280000,
    availability: WEEKDAYS,
    bio: "Corporate chauffeur with twelve years driving senior executives around Lagos.",
    employer: "Zenith Bank Plc",
    job_title: "Executive Driver",
  },
  {
    first_name: "Aisha",
    last_name: "Bello",
    gender: "FEMALE",
    date_of_birth: "1992-07-02",
    marital_status: "SINGLE",
    state_of_residence: "Abuja Federal Capital Territory",
    city: "Wuse",
    address: "7 Aminu Kano Crescent, Wuse 2",
    state_of_origin: "Kano",
    driver_type: "PRIVATE_DRIVER",
    transmission: "AUTOMATIC",
    licence_classes: ["B"],
    years_of_experience: 6,
    academic_level: "BSC",
    institution: "Bayero University Kano",
    course_of_study: "Mass Communication",
    languages: ["English", "Hausa"],
    religion: "ISLAM",
    ethnicity: "Hausa",
    expected_monthly_rate_major: 220000,
    availability: [
      { day_range: "Mon - Fri", start: "7:00 AM", end: "5:00 PM" },
      { day_range: "Sat", start: "9:00 AM", end: "2:00 PM" },
    ],
    bio: "Private family driver, school runs and errands across Abuja.",
    employer: "Private household",
    job_title: "Family Driver",
  },
  {
    first_name: "Chinedu",
    last_name: "Okafor",
    gender: "MALE",
    date_of_birth: "1979-11-20",
    marital_status: "MARRIED",
    state_of_residence: "Rivers",
    city: "Port Harcourt",
    address: "22 Aba Road, Port Harcourt",
    state_of_origin: "Enugu",
    driver_type: "HEAVY_DUTY_DRIVER",
    transmission: "MANUAL",
    licence_classes: ["C", "D", "E"],
    years_of_experience: 20,
    academic_level: "SECONDARY",
    languages: ["English", "Igbo", "Pidgin"],
    religion: "CHRISTIANITY",
    ethnicity: "Igbo",
    expected_monthly_rate_major: 350000,
    availability: null,
    bio: "Heavy-duty truck driver, twenty years on oil and gas haulage routes.",
    employer: "Dangote Transport",
    job_title: "Truck Driver",
  },
  {
    first_name: "Kemi",
    last_name: "Oyelaran",
    gender: "FEMALE",
    date_of_birth: "1995-01-09",
    marital_status: "SINGLE",
    state_of_residence: "Oyo",
    city: "Ibadan",
    address: "3 Ring Road, Ibadan",
    state_of_origin: "Oyo",
    driver_type: "RIDE_HAILING_DRIVER",
    transmission: "AUTOMATIC",
    licence_classes: ["B"],
    years_of_experience: 3,
    academic_level: "OND",
    institution: "The Polytechnic, Ibadan",
    course_of_study: "Computer Science",
    languages: ["English", "Yoruba"],
    religion: "PREFER_NOT_TO_SAY",
    ethnicity: "Yoruba",
    expected_monthly_rate_major: null,
    availability: [{ day_range: "Mon - Sun", start: "6:00 AM", end: "10:00 PM" }],
    bio: "Ride-hailing driver with a 4.9 rating, available for daily or weekly bookings.",
    employer: "Bolt",
    job_title: "Partner Driver",
  },
  {
    first_name: "Ibrahim",
    last_name: "Musa",
    gender: "MALE",
    date_of_birth: "1988-05-30",
    marital_status: "MARRIED",
    state_of_residence: "Kano",
    city: "Nassarawa",
    address: "10 Zoo Road, Kano",
    state_of_origin: "Kano",
    driver_type: "LOGISTICS_DRIVER",
    transmission: "MANUAL",
    licence_classes: ["B", "C"],
    years_of_experience: 9,
    academic_level: "SECONDARY",
    languages: ["Hausa", "English", "Fulfulde"],
    religion: "ISLAM",
    ethnicity: "Fulani",
    expected_monthly_rate_major: 180000,
    availability: WEEKDAYS,
    bio: "Logistics driver covering northern distribution routes.",
    employer: "GIG Logistics",
    job_title: "Dispatch Van Driver",
  },
  {
    first_name: "Ngozi",
    last_name: "Eze",
    gender: "FEMALE",
    date_of_birth: "1990-09-12",
    marital_status: "DIVORCED",
    state_of_residence: "Lagos",
    city: "Lekki",
    address: "5 Admiralty Way, Lekki Phase 1",
    state_of_origin: "Enugu",
    driver_type: "PRIVATE_DRIVER",
    transmission: "BOTH",
    licence_classes: ["B"],
    years_of_experience: 7,
    academic_level: "BSC",
    institution: "University of Nigeria, Nsukka",
    course_of_study: "Sociology",
    languages: ["English", "Igbo"],
    religion: "CHRISTIANITY",
    ethnicity: "Igbo",
    expected_monthly_rate_major: 250000,
    availability: null,
    bio: "Private driver for expatriate families in Lekki and Victoria Island.",
    employer: "Shell Expat Housing",
    job_title: "Family Driver",
  },
  {
    first_name: "Emeka",
    last_name: "Nwosu",
    gender: "MALE",
    date_of_birth: "1983-02-17",
    marital_status: "MARRIED",
    state_of_residence: "Enugu",
    city: "Enugu",
    address: "18 Ogui Road, Enugu",
    state_of_origin: "Anambra",
    driver_type: "CORPORATE_DRIVER",
    transmission: "AUTOMATIC",
    licence_classes: ["B", "C"],
    years_of_experience: 14,
    academic_level: "HND",
    institution: "Institute of Management and Technology",
    course_of_study: "Accountancy",
    languages: ["English", "Igbo", "Pidgin"],
    religion: "CHRISTIANITY",
    ethnicity: "Igbo",
    expected_monthly_rate_major: 300000,
    availability: WEEKDAYS,
    bio: "Pool driver for a corporate fleet, airport and interstate runs.",
    employer: "MTN Nigeria",
    job_title: "Pool Driver",
  },
  {
    first_name: "Halima",
    last_name: "Abdullahi",
    gender: "FEMALE",
    date_of_birth: "1994-12-03",
    marital_status: "MARRIED",
    state_of_residence: "Abuja Federal Capital Territory",
    city: "Garki",
    address: "2 Ahmadu Bello Way, Garki",
    state_of_origin: "Niger",
    driver_type: "RIDE_HAILING_DRIVER",
    transmission: "AUTOMATIC",
    licence_classes: ["B"],
    years_of_experience: 2,
    academic_level: "SECONDARY",
    languages: ["Hausa", "English"],
    religion: "ISLAM",
    ethnicity: "Nupe",
    expected_monthly_rate_major: 150000,
    availability: null,
    bio: "Ride-hailing driver looking for steady private work.",
    employer: "Uber",
    job_title: "Partner Driver",
  },
  {
    first_name: "Segun",
    last_name: "Afolabi",
    gender: "MALE",
    date_of_birth: "1991-06-25",
    marital_status: "SINGLE",
    state_of_residence: "Ogun",
    city: "Abeokuta",
    address: "9 Lafenwa Road, Abeokuta",
    state_of_origin: "Ogun",
    driver_type: "LOGISTICS_DRIVER",
    transmission: "MANUAL",
    licence_classes: ["C"],
    years_of_experience: 5,
    academic_level: "OND",
    institution: "Moshood Abiola Polytechnic",
    course_of_study: "Mechanical Engineering",
    languages: ["English", "Yoruba"],
    religion: "CHRISTIANITY",
    ethnicity: "Egba",
    expected_monthly_rate_major: 170000,
    availability: [{ day_range: "Mon - Sat", start: "7:00 AM", end: "7:00 PM" }],
    bio: "Delivery and dispatch driver, Lagos-Abeokuta corridor.",
    employer: "Jumia Logistics",
    job_title: "Delivery Driver",
  },
  {
    first_name: "Blessing",
    last_name: "Udo",
    gender: "FEMALE",
    date_of_birth: "1997-04-18",
    marital_status: "SINGLE",
    state_of_residence: "Lagos",
    city: "Yaba",
    address: "21 Herbert Macaulay Way, Yaba",
    state_of_origin: "Akwa Ibom",
    driver_type: "PRIVATE_DRIVER",
    transmission: "AUTOMATIC",
    licence_classes: ["B"],
    years_of_experience: 1,
    academic_level: "BSC",
    institution: "University of Uyo",
    course_of_study: "Economics",
    languages: ["English", "Ibibio", "Pidgin"],
    religion: "CHRISTIANITY",
    ethnicity: "Ibibio",
    expected_monthly_rate_major: 160000,
    availability: WEEKDAYS,
    bio: "Newly licensed private driver, careful and punctual, available for school runs.",
    employer: "Private household",
    job_title: "Family Driver",
  },
];

const pad = (value: number, length: number) => String(value).padStart(length, "0");

const yearsFromNow = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);

  return date;
};

const emailFor = (index: number) => `seed.driver${pad(index + 1, 2)}@${EMAIL_DOMAIN}`;

const buildProfile = (driver: SeedDriver, index: number): Prisma.DriverProfileCreateWithoutUserInput => ({
  state_of_origin: driver.state_of_origin,
  years_of_experience: driver.years_of_experience,
  driver_type: driver.driver_type,
  transmission: driver.transmission,
  licence_classes: driver.licence_classes,
  license_number: `LAG${pad(48213 + index * 137, 6)}AA${pad(index + 1, 2)}`,
  license_expires_at: yearsFromNow(2 + (index % 3)),
  academic_level: driver.academic_level,
  institution: driver.institution,
  course_of_study: driver.course_of_study,
  languages: driver.languages,
  language_count: driver.languages.length,
  religion: driver.religion,
  ethnicity: driver.ethnicity,
  expected_monthly_rate: driver.expected_monthly_rate_major === null ? null : driver.expected_monthly_rate_major * 100,
  availability: driver.availability ?? undefined,
  verification_status: "APPROVED",
  is_discoverable: true,
  onboarding_step: "REVIEW",
  onboarding_completed_at: new Date(),
  work_experiences: {
    create: {
      employer: driver.employer,
      job_title: driver.job_title,
      started_at: yearsFromNow(-Math.max(driver.years_of_experience, 1)),
      is_current: true,
    },
  },
  guarantors: {
    create: {
      full_name: GUARANTOR_NAMES[index % GUARANTOR_NAMES.length],
      relationship: index % 2 ? "COMMUNITY_LEADER" : "RELIGIOUS_LEADER",
      phone_no: `+234805200${pad(index + 1, 4)}`,
      address: `${index + 4} Church Street, ${driver.city}`,
      nin: `7021000${pad(index + 1, 4)}`,
      passport_url: PLACEHOLDER_IMAGE,
      nin_slip_url: PLACEHOLDER_IMAGE,
    },
  },
  reference: {
    create: { full_name: "Adaeze Okonkwo", company_name: driver.employer, phone_no: `+234809400${pad(index + 1, 4)}` },
  },
});

const buildUser = (driver: SeedDriver, index: number, email: string, password: string): Prisma.UserCreateInput => ({
  email,
  password,
  role: "DRIVER",
  account_status: "ACTIVE",
  first_name: driver.first_name,
  last_name: driver.last_name,
  has_validated_email: true,
  terms_accepted_at: new Date(),
  phone_no: `+234803100${pad(index + 1, 4)}`,
  gender: driver.gender,
  date_of_birth: new Date(driver.date_of_birth),
  marital_status: driver.marital_status,
  country: "Nigeria",
  state_of_residence: driver.state_of_residence,
  city: driver.city,
  address: driver.address,
  timezone: "Africa/Lagos",
  bio: driver.bio,
  driver_profile: { create: buildProfile(driver, index) },
  documents: {
    create: ALL_DOCUMENTS.map(type => ({
      type,
      url: PLACEHOLDER_IMAGE,
      public_id: `seed/${email}/${type.toLowerCase()}`,
      file_name: `${type.toLowerCase()}.jpg`,
      mime_type: "image/jpeg",
      status: "APPROVED" as const,
      reviewed_at: new Date(),
    })),
  },
  driver_verification: {
    create: { status: "APPROVED", submitted_at: new Date(), reviewed_at: new Date(), attempts: 1 },
  },
});

const emailCredentials = async (credentials: { name: string; email: string }[], password: string) => {
  const signInUrl = `${surfaceUrlFor("DRIVER")}/driver/auth/signin`;
  const lines = credentials.map(({ name, email }) => `${name} - ${email}`).join("\n");

  const message = generateProfessionalEmail({
    type: "general",
    title: `${credentials.length} test driver accounts are ready`,
    recipientName: "team",
    message: `These verified driver accounts were created for testing. Every account uses the same password.\n\nPassword: ${password}\n\n${lines}`,
    buttonText: "Sign in as a driver",
    buttonAction: signInUrl,
  });

  for (const recipient of CREDENTIAL_RECIPIENTS) {
    await transportMail({ email: recipient, subject: "Haya test driver credentials", message });
  }
};

export const seedTestDrivers = async () => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_DRIVER_SEED !== "true") {
    throw new Error("Test-driver seeding is disabled in production. Set ALLOW_TEST_DRIVER_SEED=true only if this is intentional.");
  }

  const shouldEmailCredentials = process.env.SEED_DRIVER_EMAIL_CREDENTIALS === "true";

  if (shouldEmailCredentials && !process.env.RESEND_API_KEY) throw new Error("SEED_DRIVER_EMAIL_CREDENTIALS=true requires RESEND_API_KEY");

  const walletRepo = new WalletRepository();
  const activityService = new ActivityService();
  const trustScoreService = new TrustScoreService();

  const password = process.env.SEED_DRIVER_PASSWORD || generateRandomPassword();
  const hashed = await hashPassword(password);
  const created: { id: string; name: string; email: string }[] = [];

  for (const [index, driver] of DRIVERS.entries()) {
    const email = emailFor(index);

    // Skipping rather than overwriting keeps credentials from an earlier boot valid if this import is left in.
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) continue;

    const user = await prisma.user.create({ data: buildUser(driver, index, email, hashed), select: { id: true } });

    await walletRepo.ensureForUser(user.id);
    await activityService.record(user.id, "ACCOUNT_CREATED", "Account created");
    await activityService.record(user.id, "ONBOARDING_SUBMITTED", "Submitted documents for verification");
    await activityService.record(user.id, "VERIFICATION_APPROVED", "Verification approved");
    await trustScoreService.recompute(user.id);

    created.push({ id: user.id, name: `${driver.first_name} ${driver.last_name}`, email });
  }

  if (!created.length) return;

  if (shouldEmailCredentials) {
    try {
      await emailCredentials(created, password);
    } catch (error) {
      // Accounts whose password reached nobody are unusable, so they go and the next run tries again.
      await prisma.user.deleteMany({ where: { id: { in: created.map(({ id }) => id) } } });
      throw error;
    }

    console.log(`🌱 Seeded ${created.length} test driver(s); credentials emailed to ${CREDENTIAL_RECIPIENTS.length} recipient(s).`);
    return;
  }

  console.log(`🌱 Seeded ${created.length} test driver(s).`);
  console.log(`🔑 Shared password: ${password}`);
  console.table(created.map(({ name, email }) => ({ name, email })));
};

seedTestDrivers()
  .catch(error => {
    console.error("❌ Seeding test drivers failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
