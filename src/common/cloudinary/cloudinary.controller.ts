import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';
import * as fs from 'fs';
import * as util from 'util';

const unlink = util.promisify(fs.unlink);

@Controller('upload')
export class CloudinaryController {
  constructor(private cloudinaryService: CloudinaryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { dest: './uploads' }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    try {
      const result = await this.cloudinaryService.uploadImage(file.path);
      return { url: result.secure_url };
    } finally {
      // remove local file
      try {
        await unlink(file.path);
      } catch (e) {
        // ignore
      }
    }
  }
}
