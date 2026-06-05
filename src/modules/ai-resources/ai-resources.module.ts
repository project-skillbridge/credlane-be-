import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AiLearningResource } from './entities/ai-learning-resource.entity';
import { AiResourcesService } from './ai-resources.service';
import { AiResourcesController } from './ai-resources.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiLearningResource, TalentProfile])],
  controllers: [AiResourcesController],
  providers: [AiResourcesService],
  exports: [AiResourcesService],
})
export class AiResourcesModule {}
