import { Test, TestingModule } from '@nestjs/testing';
import { SubcategoriaAttributesService } from './subcategoria-attributes.service';

describe('SubcategoriaAttributesService', () => {
  let service: SubcategoriaAttributesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubcategoriaAttributesService],
    }).compile();

    service = module.get<SubcategoriaAttributesService>(SubcategoriaAttributesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
