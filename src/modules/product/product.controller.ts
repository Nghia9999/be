import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Query,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import * as fs from 'fs';
import * as util from 'util';

const unlink = util.promisify(fs.unlink);

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createProductDto: CreateProductDto,
  ) {
    // if files uploaded, upload them to Cloudinary and attach URLs
    if (files && files.length) {
      const urls: string[] = [];
      for (const f of files) {
        try {
          const r = await this.cloudinaryService.uploadImage(f.path);
          if (r?.secure_url) urls.push(r.secure_url);
        } catch (e) {
          console.error('Upload error', e);
        } finally {
          try {
            await unlink(f.path);
          } catch (e) {}
        }
      }
      createProductDto.images = urls;
    }

    return this.productService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('limit') limit: number = 50,
    @Query('skip') skip: number = 0,
  ) {
    return this.productService.findAll(category, limit, skip);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
