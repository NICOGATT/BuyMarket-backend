import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoriaService } from './subcategoria.service';

describe('SubcategoriaService', () => {
  let service: SubcategoriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubcategoriaService],
    }).compile();

    service = module.get<SubcategoriaService>(SubcategoriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
