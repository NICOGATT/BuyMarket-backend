import { Test, TestingModule } from '@nestjs/testing';
import { CategorySuggestionsController } from './category-suggestions.controller';
import { CategorySuggestionsService } from './category-suggestions.service';

describe('CategorySuggestionsController', () => {
  let controller: CategorySuggestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategorySuggestionsController],
      providers: [CategorySuggestionsService],
    }).compile();

    controller = module.get<CategorySuggestionsController>(CategorySuggestionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
