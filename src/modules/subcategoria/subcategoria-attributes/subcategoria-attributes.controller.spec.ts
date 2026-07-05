import { Test, TestingModule } from '@nestjs/testing';

import { SubCategoryAttributesController } from './subcategoria-attributes.controller';
import { SubCategoryAttributesService } from './subcategoria-attributes.service';

describe('SubCategoryAttributesController', () => {
  let controller: SubCategoryAttributesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubCategoryAttributesController],
      providers: [
        {
          provide: SubCategoryAttributesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findBySubCategory: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubCategoryAttributesController>(
      SubCategoryAttributesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
