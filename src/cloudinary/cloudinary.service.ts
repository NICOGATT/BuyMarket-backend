import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ProductMediaType } from '../modules/products/product-media/entities/product-media.entity';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: Express.Multer.File,
    folder = 'buymarket/products',
    type: ProductMediaType,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: type === ProductMediaType.VIDEO ? 'video' : 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}