import "dotenv/config";
import { prisma } from "../helper/prisma";

/*
  Development seed for the training area. There is no admin UI yet, so until one
  exists this script is how courses get into the database.

  Videos point at public YouTube watch URLs. That is a stand-in: the real course
  videos will be uploaded and served from Cloudinary like every other asset, and
  the player already reads whatever `video_url` holds. Replace the urls here, or
  the rows themselves, once the admin app can author courses.

  Idempotent — every course is upserted by slug and its modules are replaced, so
  re-running after an edit updates in place instead of duplicating. Enrollments
  and module progress reference module ids, so a re-run resets progress on the
  courses it touches. That is fine in development and is why this is not wired
  into `prestart`.

  Usage: npx tsx src/scripts/seed-courses.ts
*/

interface SeedModule {
  title: string;
  description: string;
  video_url: string;
  duration_minutes: number;
}

interface SeedCourse {
  slug: string;
  title: string;
  summary: string;
  category: string;
  is_required: boolean;
  position: number;
  trust_score_reward: number;
  certificate_validity_months: number | null;
  modules: SeedModule[];
}

const COURSES: SeedCourse[] = [
  {
    slug: "getting-started-as-a-tegat-driver",
    title: "Getting started as a Tegat driver",
    summary: "How the platform works, what clients expect, and how to get your first booking.",
    category: "ONBOARDING",
    is_required: true,
    position: 1,
    trust_score_reward: 6,
    certificate_validity_months: null,
    modules: [
      {
        title: "What Tegat is and how bookings reach you",
        description: "Where job requests come from and what happens after you accept one.",
        video_url: "https://www.youtube.com/watch?v=1aA1WGON49E",
        duration_minutes: 5,
      },
      {
        title: "Your profile, your visibility",
        description: "Why your profile stays private until every check clears, and what clients see once it does.",
        video_url: "https://www.youtube.com/watch?v=hJ7R0qkTvBQ",
        duration_minutes: 4,
      },
      {
        title: "Accepting and declining well",
        description: "Reading a request properly, and declining without hurting your reliability score.",
        video_url: "https://www.youtube.com/watch?v=SqcY0GlETPk",
        duration_minutes: 6,
      },
      {
        title: "Your first week",
        description: "A checklist for the first five bookings.",
        video_url: "https://www.youtube.com/watch?v=nKIu9yen5nc",
        duration_minutes: 4,
      },
    ],
  },
  {
    slug: "professional-communication",
    title: "Professional communication",
    summary: "Client etiquette, escalation language, discretion on the job.",
    category: "SAFETY",
    is_required: true,
    position: 2,
    trust_score_reward: 6,
    certificate_validity_months: 24,
    modules: [
      {
        title: "The first two minutes",
        description: "Greeting, confirming the trip, and setting expectations before you move.",
        video_url: "https://www.youtube.com/watch?v=HAnw168huqA",
        duration_minutes: 8,
      },
      {
        title: "Discretion and confidentiality",
        description: "What you hear in the car stays in the car, and where the line is.",
        video_url: "https://www.youtube.com/watch?v=IK-Wjm8IZBs",
        duration_minutes: 9,
      },
      {
        title: "Handling a difficult passenger",
        description: "De-escalation language, and when to end a trip.",
        video_url: "https://www.youtube.com/watch?v=Qb9nEbNr7SU",
        duration_minutes: 12,
      },
      {
        title: "Escalating to support",
        description: "What to report, how fast, and what evidence to keep.",
        video_url: "https://www.youtube.com/watch?v=uP7EBEQtTPU",
        duration_minutes: 8,
      },
      {
        title: "Written communication with clients",
        description: "Messages that read as professional in text, where tone is invisible.",
        video_url: "https://www.youtube.com/watch?v=b1IQZbnJCVA",
        duration_minutes: 8,
      },
    ],
  },
  {
    slug: "hygiene-and-grooming",
    title: "Hygiene & grooming",
    summary: "Uniform standards, personal presentation, vehicle cleanliness.",
    category: "SAFETY",
    is_required: true,
    position: 3,
    trust_score_reward: 6,
    certificate_validity_months: 24,
    modules: [
      {
        title: "Presentation standards",
        description: "What corporate clients expect a driver to look like.",
        video_url: "https://www.youtube.com/watch?v=uXlbNZ8xfLI",
        duration_minutes: 10,
      },
      {
        title: "Vehicle cleanliness",
        description: "The pre-trip clean, and what passengers notice first.",
        video_url: "https://www.youtube.com/watch?v=eVsPgQ0LQnk",
        duration_minutes: 12,
      },
      {
        title: "Personal hygiene on long days",
        description: "Staying presentable across a twelve hour booking.",
        video_url: "https://www.youtube.com/watch?v=NcQ0BC4mvxQ",
        duration_minutes: 10,
      },
      {
        title: "Handling luggage and cargo",
        description: "Lifting safely, and not damaging what you are carrying.",
        video_url: "https://www.youtube.com/watch?v=lQE1AoNqhAo",
        duration_minutes: 13,
      },
    ],
  },
  {
    slug: "elementary-mechanical-training",
    title: "Elementary mechanical training",
    summary: "Fluid checks, tyre changes, fault reporting.",
    category: "MAINTENANCE",
    is_required: true,
    position: 4,
    trust_score_reward: 6,
    certificate_validity_months: 36,
    modules: [
      {
        title: "The daily walk-around",
        description: "Six checks before the engine starts.",
        video_url: "https://www.youtube.com/watch?v=g5rHNhnFXWo",
        duration_minutes: 14,
      },
      {
        title: "Fluids: oil, coolant, brake, washer",
        description: "How to check each one and what a bad reading looks like.",
        video_url: "https://www.youtube.com/watch?v=cs3lB0e6JQ8",
        duration_minutes: 16,
      },
      {
        title: "Changing a tyre safely",
        description: "On a hard shoulder, in traffic, without becoming the next incident.",
        video_url: "https://www.youtube.com/watch?v=joBmbh0AGSQ",
        duration_minutes: 18,
      },
      {
        title: "Battery, lights and belts",
        description: "The three failures that strand a driver most often.",
        video_url: "https://www.youtube.com/watch?v=RXpNvpFYrGE",
        duration_minutes: 15,
      },
      {
        title: "Reporting a fault properly",
        description: "What the client needs to know, and what goes to support.",
        video_url: "https://www.youtube.com/watch?v=6cCLVKKUJfI",
        duration_minutes: 17,
      },
    ],
  },
  {
    slug: "first-aid-and-fire-safety",
    title: "First aid & fire safety",
    summary: "Roadside first response and extinguisher handling.",
    category: "SAFETY",
    is_required: true,
    position: 5,
    trust_score_reward: 6,
    certificate_validity_months: 12,
    modules: [
      {
        title: "Making the scene safe",
        description: "What to do in the first sixty seconds after a collision.",
        video_url: "https://www.youtube.com/watch?v=9RYtRSSuNAY",
        duration_minutes: 15,
      },
      {
        title: "Bleeding, burns and breaks",
        description: "Roadside first response until the ambulance arrives.",
        video_url: "https://www.youtube.com/watch?v=NxO5LvgqZe0",
        duration_minutes: 18,
      },
      {
        title: "CPR basics",
        description: "Compressions, rhythm, and when to stop.",
        video_url: "https://www.youtube.com/watch?v=cosVBV96E2g",
        duration_minutes: 16,
      },
      {
        title: "Vehicle fires and extinguisher use",
        description: "PASS technique, and the fires you do not fight.",
        video_url: "https://www.youtube.com/watch?v=Y6Ba9uCzOL0",
        duration_minutes: 14,
      },
      {
        title: "Emergency numbers and reporting",
        description: "Who to call in Lagos, and what they will ask you.",
        video_url: "https://www.youtube.com/watch?v=8vBBUS7Fbxw",
        duration_minutes: 12,
      },
    ],
  },
  {
    slug: "defensive-driving-in-lagos-traffic",
    title: "Defensive driving in Lagos traffic",
    summary: "Hazard perception, convoy discipline, night driving.",
    category: "DRIVING",
    is_required: false,
    position: 6,
    trust_score_reward: 6,
    certificate_validity_months: 24,
    modules: [
      {
        title: "Hazard perception",
        description: "Reading the road three vehicles ahead.",
        video_url: "https://www.youtube.com/watch?v=2sHRuOtGBbg",
        duration_minutes: 14,
      },
      {
        title: "Following distance and braking",
        description: "The two-second rule, and why it doubles in rain.",
        video_url: "https://www.youtube.com/watch?v=lcCwK6R4rvA",
        duration_minutes: 12,
      },
      {
        title: "Okada, danfo and pedestrians",
        description: "Sharing a Lagos road with everything else on it.",
        video_url: "https://www.youtube.com/watch?v=ZzWpxfDrbLw",
        duration_minutes: 13,
      },
      {
        title: "Night driving",
        description: "Glare, fatigue and unlit hazards.",
        video_url: "https://www.youtube.com/watch?v=4ItYyC7gU3w",
        duration_minutes: 11,
      },
      {
        title: "Convoy discipline",
        description: "Spacing, comms and keeping a principal's vehicle in sight.",
        video_url: "https://www.youtube.com/watch?v=RxJqNPMkG-0",
        duration_minutes: 10,
      },
    ],
  },
  {
    slug: "handling-payments-and-payouts",
    title: "Handling payments & payouts",
    summary: "How money reaches your wallet, and how to withdraw it.",
    category: "PAYMENTS",
    is_required: false,
    position: 7,
    trust_score_reward: 4,
    certificate_validity_months: null,
    modules: [
      {
        title: "How a booking becomes money",
        description: "From completion to cleared funds, and the platform fee in between.",
        video_url: "https://www.youtube.com/watch?v=Zn9E8i7hqOI",
        duration_minutes: 6,
      },
      {
        title: "Pending versus available",
        description: "Why a payment sits before you can withdraw it.",
        video_url: "https://www.youtube.com/watch?v=xnWJ4b9ZLE0",
        duration_minutes: 5,
      },
      {
        title: "Adding your payout account",
        description: "Why we resolve the account name with your bank instead of asking you to type it.",
        video_url: "https://www.youtube.com/watch?v=YQ4tR5ZL4hs",
        duration_minutes: 4,
      },
      {
        title: "Requesting a withdrawal",
        description: "Timing, limits, and what a failed payout looks like.",
        video_url: "https://www.youtube.com/watch?v=jUEfKfyi3XY",
        duration_minutes: 5,
      },
    ],
  },
  {
    slug: "building-a-5-star-trust-score",
    title: "Building a 5-star trust score",
    summary: "What moves the number, and what does not.",
    category: "GROWTH",
    is_required: false,
    position: 8,
    trust_score_reward: 4,
    certificate_validity_months: null,
    modules: [
      {
        title: "The four things the score measures",
        description: "Verification, training, completed bookings and client ratings.",
        video_url: "https://www.youtube.com/watch?v=4pLUleLdwY4",
        duration_minutes: 5,
      },
      {
        title: "Reliability",
        description: "Cancellations, late arrivals and how quickly they are forgotten.",
        video_url: "https://www.youtube.com/watch?v=CJhKMOFQxJk",
        duration_minutes: 7,
      },
      {
        title: "Earning good reviews",
        description: "What clients actually write about, drawn from real feedback.",
        video_url: "https://www.youtube.com/watch?v=aOEsRIzPGFY",
        duration_minutes: 6,
      },
      {
        title: "Keeping certifications current",
        description: "Which certificates expire, and what happens to your score when they do.",
        video_url: "https://www.youtube.com/watch?v=nGeKSiCQkPw",
        duration_minutes: 6,
      },
    ],
  },
];

const run = async () => {
  for (const { modules, ...course } of COURSES) {
    const estimated_minutes = modules.reduce((total, module) => total + module.duration_minutes, 0);

    const record = await prisma.course.upsert({
      where: { slug: course.slug },
      create: { ...course, estimated_minutes, status: "PUBLISHED" },
      update: { ...course, estimated_minutes, status: "PUBLISHED" },
      select: { id: true },
    });

    await prisma.courseModule.deleteMany({ where: { courseId: record.id } });

    await prisma.courseModule.createMany({
      data: modules.map((module, index) => ({ ...module, courseId: record.id, position: index + 1 })),
    });

    console.log(`  ${course.slug} — ${modules.length} modules, ${estimated_minutes} mins`);
  }

  const required = COURSES.filter(course => course.is_required).length;

  console.log(`\n✅ Seeded ${COURSES.length} published courses (${required} on the required path)`);

  await prisma.$disconnect();
};

run().catch(async error => {
  console.error("❌ Failed to seed courses:", error);
  await prisma.$disconnect();
  process.exit(1);
});
