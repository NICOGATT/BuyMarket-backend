import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoriaController } from './subcategoria.controller';
import { SubcategoriaService } from './subcategoria.service';

describe('SubcategoriaController', () => {
  let controller: SubcategoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubcategoriaController],
      providers: [SubcategoriaService],
    }).compile();

    controller = module.get<SubcategoriaController>(SubcategoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
