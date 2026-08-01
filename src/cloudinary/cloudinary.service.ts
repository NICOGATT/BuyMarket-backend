import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

type CloudinaryResourceType = 'image' | 'video' | 'document';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: Express.Multer.File,
    folder = 'buymarket/products',
    type: CloudinaryResourceType,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: type === 'video' ? 'video' : 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });
  }
}
