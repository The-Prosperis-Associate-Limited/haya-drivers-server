import { ReviewRepository } from "../../repositories/booking/review.repository";
import { paginate, parsePagination } from "../../utils/pagination";

export class DriverReviewService {
  private reviewRepo = new ReviewRepository();

  async list(userId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { reviews, total } = await this.reviewRepo.findForSubject(userId, pagination);

    return paginate(reviews, total, pagination);
  }

  /*
    Everything the reviews screen puts above the feed. `top_strength` is the tag
    clients picked most often, so it is null until someone has actually said it -
    an unrated driver gets no strength rather than a flattering default.
  */
  async summary(userId: string) {
    const [summary, distribution, tags] = await Promise.all([
      this.reviewRepo.summaryForSubject(userId),
      this.reviewRepo.countByRatingForSubject(userId),
      this.reviewRepo.tagCountsForSubject(userId),
    ]);

    const fiveStar = distribution[5] ?? 0;

    return {
      average: summary.average,
      total: summary.total,
      rating_distribution: distribution,
      five_star_count: fiveStar,
      five_star_percent: summary.total ? Math.round((fiveStar / summary.total) * 100) : 0,
      top_strength: tags[0]?.tag ?? null,
      tags,
    };
  }
}
