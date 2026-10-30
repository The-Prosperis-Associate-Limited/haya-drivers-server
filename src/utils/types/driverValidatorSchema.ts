import z from "zod";

const phoneField = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter the number in international format, e.g. +2348012345678");

const ninField = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "A NIN is 11 digits");

export const personalInformationSchema = z.object({
  phone_no: phoneField,
  marital_status: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]),
  date_of_birth: z.coerce.date().refine(value => {
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

    return value <= eighteenYearsAgo;
  }, "You must be at least 18 to drive on Haya Drivers"),
  country: z.string().trim().min(1, "Select the country you reside in"),
  state_of_residence: z.string().trim().min(1, "Select where you reside"),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  state_of_origin: z.string().trim().min(1, "Select your state of origin"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
});

export const experienceSchema = z.object({
  years_of_experience: z.coerce.number().int().min(0, "Years of experience cannot be negative").max(60),
  driver_type: z.enum(["CORPORATE_DRIVER", "PRIVATE_DRIVER", "LOGISTICS_DRIVER", "RIDE_HAILING_DRIVER", "HEAVY_DUTY_DRIVER"]),
  transmission: z.enum(["AUTOMATIC", "MANUAL", "BOTH"], { message: "Select what transmission you can drive" }),
  licence_classes: z.array(z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "J"])).min(1, "Select at least one licence class"),
  license_number: z.string().trim().min(4, "Enter your driver licence number"),
  // The team agreed a licence must have at least a year left to run.
  license_expires_at: z.coerce.date().refine(value => {
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    return value >= oneYearOut;
  }, "Your licence must be valid for at least one more year"),
});

// Optional by design - the screen says so, and a driver without a degree is
// not a worse driver.
export const academicQualificationSchema = z.object({
  academic_level: z.enum(["NONE", "PRIMARY", "SECONDARY", "OND", "HND", "BSC", "MSC", "PHD"]),
  institution: z.string().trim().optional(),
  course_of_study: z.string().trim().optional(),
});

export const workExperienceSchema = z.object({
  experiences: z
    .array(
      z
        .object({
          employer: z.string().trim().min(1, "Enter the employer"),
          job_title: z.string().trim().min(1, "Enter the job title"),
          started_at: z.coerce.date(),
          // "" arrives when the role is current - it means "no end date", not a date.
          ended_at: z.preprocess(value => (value === "" ? undefined : value), z.coerce.date().optional().nullable()),
          is_current: z.boolean().optional().default(false),
        })
        .superRefine((entry, ctx) => {
          if (entry.ended_at && entry.ended_at < entry.started_at) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The end date cannot come before the start date", path: ["ended_at"] });
          }
        }),
    )
    .default([]),
});

// One reference (a previous employer) and exactly one guarantor, who must be
// a working professional - family and friends are not acceptable guarantors.
export const guarantorSchema = z.object({
  reference: z.object({
    full_name: z.string().trim().min(2, "Enter your reference's name"),
    company_name: z.string().trim().optional(),
    phone_no: phoneField,
  }),
  guarantors: z
    .array(
      z.object({
        full_name: z.string().trim().min(2, "Enter your guarantor name"),
        relationship: z.enum(["FORMER_EMPLOYER", "COLLEAGUE", "RELIGIOUS_LEADER", "COMMUNITY_LEADER", "OTHER"], {
          message: "Your guarantor must be a working professional, not a family member or friend",
        }),
        phone_no: phoneField,
        address: z.string().trim().min(5, "Enter your guarantor address"),
        nin: ninField,
        passport_url: z.string().url().optional(),
        nin_slip_url: z.string().url().optional(),
      }),
    )
    .length(1, "Provide exactly one guarantor"),
});

export const additionalInformationSchema = z.object({
  language_count: z.coerce.number().int().min(0).max(20).optional(),
  languages: z.array(z.string().trim().min(1)).optional().default([]),
  religion: z.string().trim().optional(),
  ethnicity: z.string().trim().max(40).optional(),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(["NIN_SLIP", "PASSPORT_PHOTO", "DRIVERS_LICENCE", "PROOF_OF_ADDRESS", "GUARANTOR_PASSPORT", "GUARANTOR_NIN_SLIP"]),
});

export const reviewDocumentSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejection_reason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // A rejection the driver cannot act on is worse than no rejection - the
    // resubmit screen renders this string verbatim.
    if (data.status === "REJECTED" && !data.rejection_reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tell the driver what needs fixing", path: ["rejection_reason"] });
    }
  });

export const reviewVerificationSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejection_reason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "REJECTED" && !data.rejection_reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Give a reason the driver can act on", path: ["rejection_reason"] });
    }
  });

// Rate arrives in minor units - the app converts before sending. Null clears a
// field; undefined leaves it untouched.
export const workPreferencesSchema = z.object({
  expected_monthly_rate: z.coerce.number().int().min(0).nullable().optional(),
  availability: z
    .array(
      z.object({
        day_range: z.string().trim().min(1, "Name the day or range"),
        start: z.string().trim().min(1, "Set a start time"),
        end: z.string().trim().min(1, "Set an end time"),
      }),
    )
    .max(7, "Seven rows cover every day of the week")
    .nullable()
    .optional(),
});

export const openToWorkSchema = z.object({ open_to_work: z.boolean() });

export type PersonalInformationInput =z.infer<typeof personalInformationSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type AcademicQualificationInput = z.infer<typeof academicQualificationSchema>;
export type WorkExperienceInput = z.infer<typeof workExperienceSchema>;
export type GuarantorInput = z.infer<typeof guarantorSchema>;
export type AdditionalInformationInput = z.infer<typeof additionalInformationSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
export type WorkPreferencesInput = z.infer<typeof workPreferencesSchema>;
