import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import { EmployerRole, EmployerRoleStatus } from './entities/employer-role.entity';
import { EmployerRolesService } from './employer-roles.service';

describe('EmployerRolesService', () => {
  let service: EmployerRolesService;

  const mockRoleRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    increment: jest.fn(),
  };

  const mockAssessmentRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerRolesService,
        { provide: getRepositoryToken(EmployerRole), useValue: mockRoleRepo },
        {
          provide: getRepositoryToken(EmployerAssessment),
          useValue: mockAssessmentRepo,
        },
      ],
    }).compile();

    service = module.get(EmployerRolesService);
    jest.clearAllMocks();
  });

  it('creates a role and validates the attached assessment belongs to the employer', async () => {
    mockAssessmentRepo.findOne.mockResolvedValue({ id: 'assessment-1' });
    mockRoleRepo.create.mockImplementation((payload: unknown) => payload);
    mockRoleRepo.save.mockImplementation(async (role: EmployerRole) => ({
      ...role,
      id: 'role-1',
    }));

    const result = await service.create('employer-1', {
      title: ' Backend Engineer ',
      category: 'Engineering',
      description: ' Build APIs ',
      employmentType: 'Full-time',
      workArrangement: 'Remote',
      salaryMin: 1000,
      salaryMax: 2000,
      currency: 'usd',
      keywords: [' NestJS ', ''],
      assessmentId: 'assessment-1',
    });

    expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'assessment-1', employer_user_id: 'employer-1' },
      select: ['id'],
    });
    expect(result).toMatchObject({
      id: 'role-1',
      employer_user_id: 'employer-1',
      title: 'Backend Engineer',
      work_arrangement: 'Remote',
      currency: 'USD',
      keywords: ['NestJS'],
      assessment_id: 'assessment-1',
      status: EmployerRoleStatus.ACTIVE,
    });
  });

  it('rejects invalid salary ranges', async () => {
    await expect(
      service.create('employer-1', {
        title: 'Role',
        category: 'Engineering',
        salaryMin: 3000,
        salaryMax: 2000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('closes and reopens a role', async () => {
    const role = {
      id: 'role-1',
      employer_user_id: 'employer-1',
      status: EmployerRoleStatus.ACTIVE,
    } as EmployerRole;
    mockRoleRepo.findOne.mockResolvedValue(role);
    mockRoleRepo.save.mockImplementation(async (next: EmployerRole) => next);

    const closed = await service.close('employer-1', 'role-1');
    expect(closed.status).toBe(EmployerRoleStatus.CLOSED);

    const reopened = await service.reopen('employer-1', 'role-1');
    expect(reopened.status).toBe(EmployerRoleStatus.ACTIVE);
  });

  it('rejects closed roles when sending offers', async () => {
    mockRoleRepo.findOne.mockResolvedValue({
      id: 'role-1',
      employer_user_id: 'employer-1',
      status: EmployerRoleStatus.CLOSED,
    });

    await expect(
      service.findActiveRoleForOffer('employer-1', 'role-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('increments the role offer count', async () => {
    mockRoleRepo.increment.mockResolvedValue({ affected: 1 });

    await service.incrementOfferCount('role-1');

    expect(mockRoleRepo.increment).toHaveBeenCalledWith(
      { id: 'role-1' },
      'offers_sent_count',
      1,
    );
  });
});
