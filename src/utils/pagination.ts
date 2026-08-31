import { PaginationQuery } from "../interface";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const parsePagination = (query: Record<string, unknown>): PaginationQuery => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));

  return { page, limit };
};

export const paginate = <T>(data: T[], total: number, { page, limit }: PaginationQuery) => ({
  data,
  total,
  page,
  totalPages: Math.ceil(total / limit) || 1,
});
