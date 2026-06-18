import { Test, TestingModule } from '@nestjs/testing';
import { CategorySuggestionsService } from './category-suggestions.service';

describe('CategorySuggestionsService', () => {
  let service: CategorySuggestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategorySuggestionsService],
    }).compile();

    service = module.get<CategorySuggestionsService>(
      CategorySuggestionsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
