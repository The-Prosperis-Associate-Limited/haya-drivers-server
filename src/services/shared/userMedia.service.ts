import { CloudinaryService, type UploadFolder } from "./cloudinary.service";

const PERSONAL_FOLDERS: UploadFolder[] = ["avatar", "documents", "guarantors", "certificates"];

export class UserMediaService {
  private cloudinaryService = new CloudinaryService();

  // Payment receipts are financial records and survive an anonymise; a full delete only happens when no such record exists.
  async purge(userId: string, role: string, { includePayments = false } = {}) {
    const folders = includePayments ? [...PERSONAL_FOLDERS, "payments" as const] : PERSONAL_FOLDERS;

    const results = await Promise.allSettled(folders.map(folder => this.cloudinaryService.deleteFolder(userId, role, folder)));
    const failed = results.filter(result => result.status === "rejected");

    for (const result of failed) console.error(`Media purge ${userId}: Cloudinary cleanup failed`, (result as PromiseRejectedResult).reason);

    return { folders: folders.length, failed: failed.length };
  }
}
