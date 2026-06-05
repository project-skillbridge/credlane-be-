import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerRolesService } from './employer-roles.service';
import { AttachAssessmentDto } from './dto/attach-assessment.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { EmployerRoleStatus } from './entities/employer-role.entity';

@ApiTags('Employer Roles')
@ApiBearerAuth()
@Roles(UserRole.EMPLOYER)
@Controller('employer/roles')
export class EmployerRolesController {
  constructor(private readonly rolesService: EmployerRolesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateRoleDto) {
    const role = await this.rolesService.create(userId, dto);
    return { status: 'success', message: 'Role created', data: role };
  }

  @Get()
  @ApiOperation({ summary: 'List all roles for the employer' })
  @ApiQuery({ name: 'status', required: false, enum: EmployerRoleStatus })
  @ApiResponse({ status: 200, description: 'Roles list' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: EmployerRoleStatus,
  ) {
    const roles = await this.rolesService.findAllForEmployer(userId, status);
    return { status: 'success', data: roles };
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get a single role by ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.findOneForEmployer(userId, roleId);
    return { status: 'success', data: role };
  }

  @Patch(':roleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.rolesService.update(userId, roleId, dto);
    return { status: 'success', message: 'Role updated', data: role };
  }

  @Patch(':roleId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a role (no new offers can be sent)' })
  @ApiResponse({ status: 200, description: 'Role closed' })
  async close(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.close(userId, roleId);
    return { status: 'success', message: 'Role closed', data: role };
  }

  @Patch(':roleId/assessment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach an existing assessment to a role' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async attachAssessment(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AttachAssessmentDto,
  ) {
    const role = await this.rolesService.attachAssessment(
      userId,
      roleId,
      dto.assessmentId,
    );
    return {
      status: 'success',
      message: 'Assessment attached to role',
      data: role,
    };
  }

  @Patch(':roleId/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a closed role' })
  @ApiResponse({ status: 200, description: 'Role reopened' })
  async reopen(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.reopen(userId, roleId);
    return { status: 'success', message: 'Role reopened', data: role };
  }
}
