import { Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { IUserRequest } from "../interface";
import { SearchService } from "../services/shared/search.service";
import { searchQuerySchema } from "../utils/types/searchValidatorSchema";

export class SearchController {
  private searchService = new SearchService();

  client = async (req: IUserRequest, res: Response) => {
    try {
      const { q } = searchQuerySchema.parse(req.query);

      res.status(200).json({ message: "Search results", data: await this.searchService.forClient(req.userId as string, q) });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  driver = async (req: IUserRequest, res: Response) => {
    try {
      const { q } = searchQuerySchema.parse(req.query);

      res.status(200).json({ message: "Search results", data: await this.searchService.forDriver(req.userId as string, q) });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  admin = async (req: IUserRequest, res: Response) => {
    try {
      const { q } = searchQuerySchema.parse(req.query);

      res.status(200).json({ message: "Search results", data: await this.searchService.forAdmin(q) });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
