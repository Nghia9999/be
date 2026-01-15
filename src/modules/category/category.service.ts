import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './category.schema';
import slugify from 'slugify';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto) {
    let level = 0;

    let parentSlug: string | null = null;
    if (dto.parent) {
      const parentCat = await this.categoryModel.findById(dto.parent).lean();
      if (!parentCat) throw new NotFoundException('Parent category không tồn tại');

      level = (parentCat as any).level + 1;
      parentSlug = (parentCat as any).slug || null;

      await this.categoryModel.findByIdAndUpdate(dto.parent, { isLeaf: false });
    }

    const baseSlug = slugify(dto.name, { lower: true, strict: true, locale: 'vi' });
    const slug = parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug;

    const created = await this.categoryModel.create({
      ...dto,
      slug,
      level,
      isLeaf: true,
    });

    return created;
  }

  async findAll(parent?: string) {
    const filter: any = {};
    if (parent) filter.parent = parent;
    return this.categoryModel.find(filter).sort({ level: 1, name: 1 }).lean();
  }

  async findOne(id: string) {
    const cat = await this.categoryModel.findById(id).lean();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, dto as any, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async remove(id: string) {
    const res = await this.categoryModel.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException('Category not found');
    return { ok: true };
  }
}
