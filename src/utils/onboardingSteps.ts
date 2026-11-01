import type { $Enums } from "../generated/prisma/client";

// The order the onboarding screens run in. `onboarding_step` on the profile is
// how far the driver has got, so the client can resume where they stopped.
export const ONBOARDING_ORDER: $Enums.OnboardingStep[] = [
  "PERSONAL_INFORMATION",
  "EXPERIENCE",
  "ACADEMIC_QUALIFICATION",
  "WORK_EXPERIENCE",
  "GUARANTORS",
  "ADDITIONAL_INFORMATION",
  "DOCUMENTS",
  "REVIEW",
];

// Never moves a driver backwards. Editing an earlier step after reaching the
// review screen must not send them back to the start of the wizard.
export const advanceStep = (current: $Enums.OnboardingStep, completed: $Enums.OnboardingStep): $Enums.OnboardingStep => {
  const next = ONBOARDING_ORDER[Math.min(ONBOARDING_ORDER.indexOf(completed) + 1, ONBOARDING_ORDER.length - 1)];

  return ONBOARDING_ORDER.indexOf(next) > ONBOARDING_ORDER.indexOf(current) ? next : current;
};

// Every document blocks submission - the owner made the guarantor files and proof of address mandatory on 1 Nov 2026.
export const REQUIRED_DOCUMENTS: $Enums.DocumentType[] = ["NIN_SLIP", "PASSPORT_PHOTO", "DRIVERS_LICENCE", "PROOF_OF_ADDRESS", "GUARANTOR_PASSPORT", "GUARANTOR_NIN_SLIP"];

export const DOCUMENT_LABELS: Record<$Enums.DocumentType, string> = {
  NIN_SLIP: "NIN slip",
  PASSPORT_PHOTO: "Passport photo",
  DRIVERS_LICENCE: "Driver licence",
  PROOF_OF_ADDRESS: "Proof of address",
  GUARANTOR_PASSPORT: "Guarantor passport photo",
  GUARANTOR_NIN_SLIP: "Guarantor NIN slip",
};

export const ONBOARDING_STEP_LABELS: Record<$Enums.OnboardingStep, string> = {
  PERSONAL_INFORMATION: "step 1 of 8 (Personal information)",
  EXPERIENCE: "step 2 of 8 (Experience)",
  ACADEMIC_QUALIFICATION: "step 3 of 8 (Academic qualification)",
  WORK_EXPERIENCE: "step 4 of 8 (Work experience)",
  GUARANTORS: "step 5 of 8 (Guarantors)",
  ADDITIONAL_INFORMATION: "step 6 of 8 (Additional information)",
  DOCUMENTS: "step 7 of 8 (Documents)",
  REVIEW: "step 8 of 8 (Review)",
};
