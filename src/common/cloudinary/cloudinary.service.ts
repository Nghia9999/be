import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME') || process.env.CLOUDINARY_CLOUD_NAME,
      api_key: this.config.get('CLOUDINARY_API_KEY') || process.env.CLOUDINARY_API_KEY,
      api_secret: this.config.get('CLOUDINARY_API_SECRET') || process.env.CLOUDINARY_API_SECRET,
    });
  }

  uploadImage(filePath: string, options = {}): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, options, (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      });
    });
  }
}
