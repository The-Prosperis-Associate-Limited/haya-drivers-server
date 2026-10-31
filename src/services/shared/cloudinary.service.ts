import { Readable } from "stream";
import cloudinary from "../../utils/cloudinaryConfig";
import { UploadApiResponse } from "cloudinary";

export type UploadFolder = "avatar" | "documents" | "guarantors" | "certificates" | "payments";
type ResourceType = "image" | "raw" | "video";

// "auto" uploads pick the type themselves (PDFs land as image), so the stored url is the only reliable record of it.
export const resourceTypeOf = (url: string): ResourceType => (url.match(/\/(image|raw|video)\/upload\//)?.[1] as ResourceType | undefined) ?? "image";

export class CloudinaryService {
  async uploadFile(userId: string, role: string, file: Express.Multer.File, folder: UploadFolder) {
    return await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `haya/${role.toLowerCase()}/${userId}/${folder}`,
          resource_type: folder === "avatar" ? "image" : "auto",
        },
        (error, result) => {
          if (error) return reject(error);
          if (result?.secure_url) return resolve(result);

          reject(new Error("Cloudinary upload failed!"));
        },
      );

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(stream);
    });
  }

  async deleteFile(publicId: string, resourceType: ResourceType = "image") {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }

  // The admin API deletes one resource type per call, and "auto" uploads may have landed as any of them.
  async deleteFolder(userId: string, role: string, folder: UploadFolder) {
    const prefix = `haya/${role.toLowerCase()}/${userId}/${folder}/`;
    const types: ResourceType[] = ["image", "raw", "video"];

    return Promise.all(types.map(resource_type => cloudinary.api.delete_resources_by_prefix(prefix, { resource_type })));
  }
}
