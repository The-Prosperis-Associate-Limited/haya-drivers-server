import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import type { OnboardingInsightsInput } from "../../utils/types/clientValidatorSchema";

const CATEGORY_TO_DRIVER_TYPES: Partial<Record<$Enums.ClientDriverCategory, $Enums.DriverType[]>> = {
  PRIVATE: ["PRIVATE_DRIVER"],
  CORPORATE: ["CORPORATE_DRIVER"],
  EXECUTIVE: ["CORPORATE_DRIVER", "PRIVATE_DRIVER"],
  EXPATRIATE: ["CORPORATE_DRIVER", "PRIVATE_DRIVER"],
};

const MIN_RATES_FOR_LOCAL_MARKET = 5;
const IGNORED_PLACE_WORDS = new Set(["state", "city", "nigeria", "area", "the", "and"]);

const places = (location?: string) =>
  [...new Set((location ?? "").split(/[,/]+|\s+-\s+/).map(part => part.trim()).filter(part => part.length >= 3 && !IGNORED_PLACE_WORDS.has(part.toLowerCase())))].slice(0, 4);

const percentile = (sorted: number[], ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))];

export class ClientOnboardingInsightsService {
  private driverProfileRepo = new DriverProfileRepository();

  async insights(query: OnboardingInsightsInput) {
    // CONTRACT and SPY describe an arrangement, not a kind of driver, so picking either widens the pool to every type.
    const typeFilter = query.categories?.length && query.categories.every(category => CATEGORY_TO_DRIVER_TYPES[category]) ? [...new Set(query.categories.flatMap(category => CATEGORY_TO_DRIVER_TYPES[category]!))] : undefined;
    const placeList = places(query.location);

    const [nearby, national] = await Promise.all([
      placeList.length ? this.driverProfileRepo.findMatchPool({ places: placeList, driverTypes: typeFilter }) : Promise.resolve(null),
      this.driverProfileRepo.findMatchPool({ places: [], driverTypes: typeFilter }),
    ]);

    const pool = nearby ?? national;
    const localRates = pool.map(driver => driver.expected_monthly_rate).filter((rate): rate is number => rate !== null).sort((a, b) => a - b);
    const nationalRates = national.map(driver => driver.expected_monthly_rate).filter((rate): rate is number => rate !== null).sort((a, b) => a - b);
    const useLocal = !!nearby && localRates.length >= MIN_RATES_FOR_LOCAL_MARKET;
    const rates = useLocal ? localRates : nationalRates;

    const withinBudget = query.budget ? pool.filter(driver => driver.expected_monthly_rate === null || driver.expected_monthly_rate <= query.budget!) : pool;

    return {
      location: placeList.join(", ") || null,
      nearby_count: pool.length,
      scope: nearby ? "local" : "national",
      market: rates.length
        ? { scope: useLocal ? "local" : "national", low_minor: percentile(rates, 0.25), median_minor: percentile(rates, 0.5), high_minor: percentile(rates, 0.75), min_minor: rates[0], max_minor: rates[rates.length - 1], sample: rates.length }
        : null,
      budget_minor: query.budget ?? null,
      within_budget_count: query.budget ? withinBudget.length : null,
      within_budget_pct: query.budget && pool.length ? Math.round((withinBudget.length / pool.length) * 100) : null,
      matches: withinBudget.slice(0, 3).map(driver => ({
        id: driver.userId,
        name: [driver.user.first_name, driver.user.last_name].filter(Boolean).join(" "),
        profile_pic: driver.user.profile_pic,
        driver_type: driver.driver_type,
        years_of_experience: driver.years_of_experience,
        location: [driver.user.city, driver.user.state_of_residence].filter(Boolean).join(", ") || null,
        trust_score: driver.trust_score,
        expected_monthly_rate: driver.expected_monthly_rate,
      })),
      currency: "NGN",
    };
  }
}
