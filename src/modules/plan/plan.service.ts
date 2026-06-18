import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  async create(createPlanDto: CreatePlanDto) {
    const plan = this.plansRepository.create({
      name: createPlanDto.name,
      commissionPercentage: createPlanDto.commissionPercentage,
      isActive: createPlanDto.isActive ?? true,
    });

    return this.plansRepository.save(plan);
  }

  async findAll() {
    return this.plansRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const plan = await this.plansRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    return plan;
  }

  async findFreePlan() {
    const plan = await this.plansRepository.findOne({
      where: {
        name: 'Free',
        isActive: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan Free no encontrado');
    }

    return plan;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto) {
    const plan = await this.findOne(id);

    Object.assign(plan, updatePlanDto);

    return this.plansRepository.save(plan);
  }

  async remove(id: string) {
    const plan = await this.findOne(id);

    await this.plansRepository.remove(plan);

    return {
      message: 'Plan eliminado correctamente',
    };
  }
}
