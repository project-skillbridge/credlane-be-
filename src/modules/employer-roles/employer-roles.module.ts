import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import { EmployerRole } from './entities/employer-role.entity';
import { EmployerRolesService } from './employer-roles.service';
import { EmployerRolesController } from './employer-roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmployerRole, EmployerAssessment])],
  controllers: [EmployerRolesController],
  providers: [EmployerRolesService],
  exports: [EmployerRolesService],
})
export class EmployerRolesModule {}
