import "dotenv/config";
import { prisma } from "../helper/prisma";

/*
  Development seed for the training area. There is no admin UI yet, so until one
  exists this script is how courses get into the database.

  Two kinds of module. Ones with `video_url` point at publicly listed third-party
  YouTube videos — every id below was checked against YouTube's oembed endpoint
  before it was written here, so none of them is invented. They are development
  scaffolding, not licensed course content: Drivers Vault's own videos will be uploaded
  and served from Cloudinary like every other asset, and the player already plays
  whatever `video_url` holds. Ones with `content` are platform-specific material
  no third-party video can teach — how payouts clear, how the trust score is
  weighted — so they are written here as text rather than pointed at something
  that does not cover it.

  Idempotent — every course is upserted by slug and its modules are replaced, so
  re-running after an edit updates in place instead of duplicating. Enrollments
  and module progress reference module ids, so a re-run resets progress on the
  courses it touches. That is fine in development and is why this is not wired
  into `prestart`.

  Usage: npx tsx src/scripts/seed-courses.ts   (or `npm run seed:courses`)
*/

interface SeedModule {
  title: string;
  description: string;
  duration_minutes: number;
  video_url?: string;
  content?: string;
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

const watch = (id: string) => `https://www.youtube.com/watch?v=${id}`;

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
        duration_minutes: 5,
        content: [
          "Clients search verified drivers near them, filtered by driver type, vehicle class and trust score. When one books you, the request lands in Job Requests with the pickup, the date and the amount already agreed.",
          "You accept or decline. Accepting moves the booking to Confirmed and locks the slot in your calendar. Declining is free — it does not count against you — but leaving a request to expire does, because the client waited on an answer that never came.",
          "On the day, you start the trip from the booking screen and complete it when the client is dropped off. Completing is what releases payment into your wallet, so a trip you forget to complete is a trip you are not paid for.",
        ].join("\n\n"),
      },
      {
        title: "Driving like a professional chauffeur",
        description: "The habits that separate a professional driver from someone with a licence.",
        duration_minutes: 11,
        video_url: watch("J93jwa6E5LI"),
      },
      {
        title: "What the best drivers do differently",
        description: "Where the top of the profession puts its attention.",
        duration_minutes: 9,
        video_url: watch("BEnO2g2j5H4"),
      },
      {
        title: "Your profile, your visibility",
        description: "Why your profile stays private until every check clears, and what clients see once it does.",
        duration_minutes: 4,
        content: [
          "Your profile is private and unsearchable until identity, licence and criminal-record checks are complete. That is deliberate: a client booking through Tegat is trusting the vetting, not the profile photo.",
          "Once you are approved you become visible to clients across your state. They see your name, your driver type, your vehicle classes, your trust score and your client reviews. They do not see your address, your documents or your guarantors.",
          "If a document is rejected, the reviewer's reason appears on your dashboard word for word. Fix only what is named and resubmit — the rest of your application stands.",
        ].join("\n\n"),
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
        title: "Think fast, talk smart",
        description: "Stanford GSB on speaking clearly under pressure.",
        duration_minutes: 58,
        video_url: watch("HAnw168huqA"),
      },
      {
        title: "Your language is important",
        description: "The words a professional driver uses, and the ones they do not.",
        duration_minutes: 8,
        video_url: watch("dk-qjNq3wQ8"),
      },
      {
        title: "Discretion with a VIP passenger",
        description: "What you hear in the car stays in the car, and where the line is.",
        duration_minutes: 12,
        video_url: watch("BVyUKv8S5No"),
      },
      {
        title: "Becoming a professional chauffeur",
        description: "Standards of service across a full booking.",
        duration_minutes: 10,
        video_url: watch("sjBTRKXB5go"),
      },
      {
        title: "Escalating to support",
        description: "What to report, how fast, and what evidence to keep.",
        duration_minutes: 6,
        content: [
          "Report anything that puts you, the vehicle or the client at risk — immediately, from the support sheet. Use Report an issue and mark it Urgent if it is blocking you now. A safety concern is never an inconvenience to us.",
          "Keep evidence before you keep tidy. Photograph damage before moving the vehicle, note the time, and keep the booking reference to hand — support cannot look up a trip you describe only as \"yesterday's airport run\".",
          "Do not negotiate money, cancellations or disputes with a client directly. Put it through support so there is a record, and so the outcome is not your word against theirs.",
        ].join("\n\n"),
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
        duration_minutes: 5,
        content: [
          "Corporate clients book a driver the way they book a meeting room: they expect it clean, on time and unremarkable. Plain dark trousers, a clean collared shirt, closed shoes. No visible logos that are not ours.",
          "Presentation holds across a twelve hour day, not just the first hour. Carry a spare shirt on long bookings, keep deodorant and a comb in the car, and step out of the vehicle to eat.",
          "The first thing a passenger judges is the door handle they touch and the seat they sit on. Both are your job before the trip starts, not after it is mentioned.",
        ].join("\n\n"),
      },
      {
        title: "Interior detailing from top to bottom",
        description: "A full interior clean, in the order a professional does it.",
        duration_minutes: 16,
        video_url: watch("81vvPTBmANs"),
      },
      {
        title: "The quick clean between bookings",
        description: "Getting the cabin presentable when you have fifteen minutes.",
        duration_minutes: 10,
        video_url: watch("lqqNdNXFrtg"),
      },
      {
        title: "Detailing like a professional",
        description: "Tools, products and technique.",
        duration_minutes: 14,
        video_url: watch("UKHzwESULwY"),
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
        description: "Lights, fluids and the checks to make before the engine starts.",
        duration_minutes: 9,
        video_url: watch("ZpKuPjYBWGI"),
      },
      {
        title: "The basic maintenance checklist",
        description: "Tyre pressure, oil level, wipers and lights.",
        duration_minutes: 6,
        video_url: watch("4z7MrwVpirs"),
      },
      {
        title: "Checking oil and coolant",
        description: "How to read each one and what a bad reading looks like.",
        duration_minutes: 8,
        video_url: watch("uSp_XonkiqE"),
      },
      {
        title: "Checking every fluid in the car",
        description: "Brake, transmission, power steering and washer fluid.",
        duration_minutes: 7,
        video_url: watch("Nu-QfdaXAQs"),
      },
      {
        title: "Changing a tyre safely",
        description: "On a hard shoulder, in traffic, without becoming the next incident.",
        duration_minutes: 12,
        video_url: watch("joBmbh0AGSQ"),
      },
      {
        title: "Reporting a fault properly",
        description: "What the client needs to know, and what goes to support.",
        duration_minutes: 5,
        content: [
          "A fault the client can see is a fault you should have named first. Tell them what it is, what it means for the trip, and what you are doing about it — in that order, in one sentence each.",
          "If the vehicle is unsafe, the booking ends there. Do not finish a trip on a tyre you do not trust because the drop-off is close. Report it as Urgent and support will arrange the client's onward journey.",
          "In the report, give the booking reference, what you observed, when it started, and whether the vehicle is still drivable. \"Something is wrong with the brakes\" starts a conversation; \"pedal goes soft after three stops, started this morning, still drivable below 40\" starts a repair.",
        ].join("\n\n"),
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
        title: "Treating severe bleeding",
        description: "St John Ambulance on roadside first response.",
        duration_minutes: 4,
        video_url: watch("NxO5LvgqZe0"),
      },
      {
        title: "Performing CPR",
        description: "Compressions, rhythm, and when to stop.",
        duration_minutes: 6,
        video_url: watch("cosVBV96E2g"),
      },
      {
        title: "Fire extinguisher training",
        description: "Extinguisher classes and what each one is for.",
        duration_minutes: 15,
        video_url: watch("yodLMfOZNvA"),
      },
      {
        title: "The PASS method",
        description: "Pull, aim, squeeze, sweep — and the fires you do not fight.",
        duration_minutes: 4,
        video_url: watch("PQV71INDaqY"),
      },
      {
        title: "Emergency numbers and reporting",
        description: "Who to call in Nigeria, and what they will ask you.",
        duration_minutes: 5,
        content: [
          "112 is the national emergency line and works from any network. In Lagos, 767 and 112 both reach the state emergency service. FRSC is 122 for road traffic incidents.",
          "They will ask where you are before anything else. Learn to give a location the way a dispatcher needs it: road name, direction of travel, and the last landmark you passed. \"Third Mainland Bridge, heading to Lagos Island, just past the Adeniji ramp\" is findable. \"On the bridge\" is not.",
          "Then tell support, with the booking reference. We contact the client so you do not have to manage a passenger's family while you are managing a scene.",
        ].join("\n\n"),
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
        title: "Hazard perception and response",
        description: "Reading the road three vehicles ahead.",
        duration_minutes: 8,
        video_url: watch("R6pzYVIO458"),
      },
      {
        title: "Five defensive driving strategies",
        description: "The habits that prevent the collision you never see coming.",
        duration_minutes: 7,
        video_url: watch("K11S1S4C1qA"),
      },
      {
        title: "Why defensive driving keeps you safe",
        description: "Anticipation, space and speed.",
        duration_minutes: 6,
        video_url: watch("7Ids8S7dLvA"),
      },
      {
        title: "Defensive driving in larger vehicles",
        description: "Blind spots, stopping distance and turning room.",
        duration_minutes: 14,
        video_url: watch("mHHmQ-rEj3Q"),
      },
      {
        title: "Carrying a full vehicle safely",
        description: "How a loaded vehicle handles differently.",
        duration_minutes: 11,
        video_url: watch("7LXMkO2v6o8"),
      },
      {
        title: "Night driving",
        description: "Headlight use, following distance and staying alert after dark.",
        duration_minutes: 9,
        video_url: watch("7GD5m-C2sH8"),
      },
      {
        title: "Glare and night vision",
        description: "Why oncoming lights blur, and what actually helps.",
        duration_minutes: 8,
        video_url: watch("aTKS5d0JXTQ"),
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
        duration_minutes: 5,
        content: [
          "Marking a booking complete is what creates the payment. The client's charge is settled against the agreed amount, the platform fee comes off, and the balance lands in your wallet.",
          "Amounts are held in kobo and shown in naira. A booking at 45,000 is stored as 4,500,000 minor units, which is why the figure on your wallet and the figure on the booking always agree to the last kobo.",
          "Every movement — payment, fee, withdrawal, reversal — is a line in your earnings history with its own reference. If a number looks wrong, the reference is what support needs to trace it.",
        ].join("\n\n"),
      },
      {
        title: "Pending versus available",
        description: "Why a payment sits before you can withdraw it.",
        duration_minutes: 4,
        content: [
          "New payments arrive as pending. Pending money is yours but not yet withdrawable — it is the window in which a client can raise a dispute over a trip that has just happened.",
          "Once the window passes, the amount moves to available and the Withdraw button unlocks for it. Your dashboard shows both figures separately for exactly this reason.",
          "A disputed booking holds its payment in pending until support closes the dispute. You are told when that happens; the money does not quietly disappear.",
        ].join("\n\n"),
      },
      {
        title: "Adding your payout account",
        description: "Why we resolve the account name with your bank instead of asking you to type it.",
        duration_minutes: 4,
        content: [
          "Add a payout account under Settings, then Earnings. You give the bank and the account number — never the account name.",
          "The name comes back from your bank through a name enquiry, and that is the name we pay. It is why a mistyped digit fails instead of quietly paying a stranger who happens to hold that account.",
          "You can hold more than one account and mark one as default. Withdrawals go to the default unless you pick another at the time.",
        ].join("\n\n"),
      },
      {
        title: "Requesting a withdrawal",
        description: "Timing, limits, and what a failed payout looks like.",
        duration_minutes: 5,
        content: [
          "Withdraw any amount up to your available balance. The request leaves your wallet immediately and shows as a withdrawal line in your history straight away.",
          "Payouts settle on banking days. One requested on a Saturday night is processed on Monday — the delay is the bank's, not a problem with your account.",
          "If a payout fails, the amount is reversed back to available and the reason is on the transaction. The usual cause is a closed or frozen account, which means fixing the payout account rather than retrying the withdrawal.",
        ].join("\n\n"),
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
        duration_minutes: 5,
        content: [
          "Your trust score is one number out of 100, built from four inputs: clearing verification, completing required training, completing bookings, and your average client rating.",
          "Verification is the largest single component and the only all-or-nothing one — it pays nothing until every check clears, then pays in full.",
          "Open Trust score from your dashboard to see what each component is worth for you right now, and the fact behind each bar. The weights live on the server and are the same for every driver.",
        ].join("\n\n"),
      },
      {
        title: "Reliability",
        description: "Cancellations, late arrivals and how quickly they are forgotten.",
        duration_minutes: 6,
        content: [
          "Reliability is completed bookings against bookings you took on. Declining a request never counts — you were never committed. Cancelling one you accepted does.",
          "The measure is a ratio, not a tally, so it recovers by completing work rather than by waiting. Two clean months genuinely outweigh one bad week.",
          "If something outside your control ends a booking — the client cancels, the vehicle fails its check — report it. Support can mark the booking so it does not count against you, but only if it is recorded at the time.",
        ].join("\n\n"),
      },
      {
        title: "Earning good reviews",
        description: "What clients actually write about.",
        duration_minutes: 6,
        content: [
          "Read your own reviews screen before guessing. The tags clients pick — punctual, safe driving, clean vehicle, good communication — are the same few every time, and they are almost never about driving skill.",
          "Arriving early is the single most mentioned thing. It is also the cheapest to fix.",
          "A rating below five is information, not an insult. One recurring complaint across several trips is a habit worth changing; one bad trip among twenty moves your score barely at all.",
        ].join("\n\n"),
      },
      {
        title: "Keeping certifications current",
        description: "Which certificates expire, and what happens to your score when they do.",
        duration_minutes: 6,
        content: [
          "Not every certificate expires. First aid and fire safety lasts twelve months, communication and grooming twenty-four, mechanical training thirty-six. Onboarding and the wallet courses do not expire at all.",
          "An expired certificate stops counting towards the training component of your score, so the number falls without you doing anything wrong. The fix is retaking the assessment, not appealing it.",
          "Your certificates and their validity dates are on the training screen under Recently earned. Check it before an expiry rather than after your score drops.",
        ].join("\n\n"),
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

    const videos = modules.filter(module => module.video_url).length;

    console.log(`  ${course.slug} — ${modules.length} modules (${videos} video, ${modules.length - videos} reading), ${estimated_minutes} mins`);
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
