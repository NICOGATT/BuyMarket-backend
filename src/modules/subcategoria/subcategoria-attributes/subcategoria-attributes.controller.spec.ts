import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoriaAttributesController } from './subcategoria-attributes.controller';
import { SubcategoriaAttributesService } from './subcategoria-attributes.service';

describe('SubcategoriaAttributesController', () => {
  let controller: SubcategoriaAttributesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubcategoriaAttributesController],
      providers: [SubcategoriaAttributesService],
    }).compile();

    controller = module.get<SubcategoriaAttributesController>(SubcategoriaAttributesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
