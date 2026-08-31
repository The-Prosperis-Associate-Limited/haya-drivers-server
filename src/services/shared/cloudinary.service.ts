import { Readable } from "stream";
import cloudinary from "../../utils/cloudinaryConfig";
import { UploadApiResponse } from "cloudinary";

type UploadFolder = "avatar" | "documents" | "guarantors" | "certificates";

export class CloudinaryService {
  async uploadFile(userId: string, role: string, file: Express.Multer.File, folder: UploadFolder) {
    return await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `tegat/${role.toLowerCase()}/${userId}/${folder}`,
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

  async deleteFile(publicId: string, resourceType: "image" | "raw" | "auto" = "image") {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
