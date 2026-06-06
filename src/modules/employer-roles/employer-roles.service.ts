import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import {
  EmployerRole,
  EmployerRoleStatus,
} from './entities/employer-role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class EmployerRolesService {
  private readonly logger = new Logger(EmployerRolesService.name);

  constructor(
    @InjectRepository(EmployerRole)
    private readonly roleRepo: Repository<EmployerRole>,
    @InjectRepository(EmployerAssessment)
    private readonly assessmentRepo: Repository<EmployerAssessment>,
  ) {}

  async create(
    employerUserId: string,
    dto: CreateRoleDto,
    jdFileUrl?: string | null,
  ): Promise<EmployerRole> {
    this.assertSalaryRange(dto.salaryMin, dto.salaryMax);
    if (dto.assessmentId) {
      await this.assertAssessmentBelongsToEmployer(
        employerUserId,
        dto.assessmentId,
      );
    }

    const title = dto.title.trim();
    const existing = await this.roleRepo.findOne({
      where: { employer_user_id: employerUserId, title },
    });
    if (existing) {
      throw new BadRequestException(
        `A role with the title "${title}" already exists.`,
      );
    }

    const rawKeywords = dto.keywords ?? dto.keyword ?? [];
    const keywords = rawKeywords.map((k) => k.trim()).filter(Boolean);
    const description = (dto.description ?? dto.jd_text)?.trim() ?? null;

    const role = this.roleRepo.create({
      employer_user_id: employerUserId,
      title,
      category: dto.category.trim(),
      description,
      jd_file_url: jdFileUrl ?? null,
      employment_type: dto.employmentType ?? null,
      work_arrangement: dto.workArrangement ?? null,
      education: dto.education?.trim() ?? null,
      keywords: keywords.length ? keywords : null,
      salary_min: dto.salaryMin ?? null,
      salary_max: dto.salaryMax ?? null,
      currency: dto.currency?.trim().toUpperCase() ?? null,
      assessment_id: dto.assessmentId ?? null,
      status: EmployerRoleStatus.ACTIVE,
    });

    const saved = await this.roleRepo.save(role);
    this.logger.log(
      `Role created: id=${saved.id} employer=${employerUserId} title="${saved.title}"`,
    );
    return saved;
  }

  async findAllForEmployer(
    employerUserId: string,
    status?: EmployerRoleStatus,
  ): Promise<EmployerRole[]> {
    const where: Record<string, unknown> = { employer_user_id: employerUserId };
    if (status) {
      where.status = status;
    }
    return this.roleRepo.find({
      where,
      order: { created_at: 'DESC' },
      relations: ['assessment'],
    });
  }

  async findOneForEmployer(
    employerUserId: string,
    roleId: string,
  ): Promise<EmployerRole> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, employer_user_id: employerUserId },
      relations: ['assessment'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(
    employerUserId: string,
    roleId: string,
    dto: UpdateRoleDto,
    jdFileUrl?: string | null,
  ): Promise<EmployerRole> {
    const role = await this.findOneForEmployer(employerUserId, roleId);

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (title !== role.title) {
        const conflict = await this.roleRepo.findOne({
          where: { employer_user_id: employerUserId, title },
        });
        if (conflict) {
          throw new BadRequestException(
            `A role with the title "${title}" already exists.`,
          );
        }
      }
      role.title = title;
    }
    if (dto.category !== undefined) role.category = dto.category.trim();
    const descriptionValue = dto.description ?? dto.jd_text;
    if (descriptionValue !== undefined) {
      role.description = descriptionValue?.trim() ?? null;
    }
    if (jdFileUrl !== undefined) {
      role.jd_file_url = jdFileUrl ?? null;
    }
    if (dto.employmentType !== undefined) {
      role.employment_type = dto.employmentType;
    }
    if (dto.workArrangement !== undefined) {
      role.work_arrangement = dto.workArrangement;
    }
    if (dto.education !== undefined) role.education = dto.education?.trim();
    const rawKeywords = dto.keywords ?? dto.keyword;
    if (rawKeywords !== undefined) {
      const keywords = rawKeywords.map((k) => k.trim()).filter(Boolean);
      role.keywords = keywords.length ? keywords : null;
    }
    if (dto.salaryMin !== undefined) role.salary_min = dto.salaryMin;
    if (dto.salaryMax !== undefined) role.salary_max = dto.salaryMax;
    if (dto.currency !== undefined) {
      role.currency = dto.currency?.trim().toUpperCase();
    }
    if (dto.assessmentId !== undefined) {
      if (dto.assessmentId) {
        await this.assertAssessmentBelongsToEmployer(
          employerUserId,
          dto.assessmentId,
        );
      }
      role.assessment_id = dto.assessmentId;
    }

    this.assertSalaryRange(role.salary_min, role.salary_max);

    return this.roleRepo.save(role);
  }

  async attachAssessment(
    employerUserId: string,
    roleId: string,
    assessmentId: string,
  ): Promise<EmployerRole> {
    return this.update(employerUserId, roleId, { assessmentId });
  }

  async close(employerUserId: string, roleId: string): Promise<EmployerRole> {
    const role = await this.findOneForEmployer(employerUserId, roleId);
    if (role.status === EmployerRoleStatus.CLOSED) {
      throw new BadRequestException('Role is already closed');
    }
    role.status = EmployerRoleStatus.CLOSED;
    return this.roleRepo.save(role);
  }

  async reopen(employerUserId: string, roleId: string): Promise<EmployerRole> {
    const role = await this.findOneForEmployer(employerUserId, roleId);
    if (role.status === EmployerRoleStatus.ACTIVE) {
      throw new BadRequestException('Role is already active');
    }
    role.status = EmployerRoleStatus.ACTIVE;
    return this.roleRepo.save(role);
  }

  async incrementOfferCount(roleId: string): Promise<void> {
    await this.roleRepo.increment({ id: roleId }, 'offers_sent_count', 1);
  }

  async findActiveRoleForOffer(
    employerUserId: string,
    roleId: string,
  ): Promise<EmployerRole> {
    const role = await this.findOneForEmployer(employerUserId, roleId);
    if (role.status !== EmployerRoleStatus.ACTIVE) {
      throw new ForbiddenException('Cannot send offers for a closed role');
    }
    return role;
  }

  async findActiveRolesForEmployer(
    employerUserId: string,
  ): Promise<EmployerRole[]> {
    return this.roleRepo.find({
      where: {
        employer_user_id: employerUserId,
        status: EmployerRoleStatus.ACTIVE,
      },
      order: { created_at: 'DESC' },
    });
  }

  private assertSalaryRange(
    salaryMin: number | null | undefined,
    salaryMax: number | null | undefined,
  ): void {
    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      throw new BadRequestException('salaryMin cannot exceed salaryMax');
    }
  }

  private async assertAssessmentBelongsToEmployer(
    employerUserId: string,
    assessmentId: string,
  ): Promise<void> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, employer_user_id: employerUserId },
      select: ['id'],
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
  }
}
