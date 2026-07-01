import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminEmployersService } from './admin-employers.service';
import { ListEmployersQueryDto } from './dto/list-employers-query.dto';

@ApiTags('admin-employers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
@Controller('admin/employers')
export class AdminEmployersController {
  constructor(private readonly employersService: AdminEmployersService) {}

  @Get()
  @ApiOperation({ summary: 'List employers (read-only)' })
  async findAll(@Query() query: ListEmployersQueryDto) {
    const data = await this.employersService.findAll(query);
    return { status: 'success', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Employer detail panel' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.employersService.findOne(id);
    return { status: 'success', data };
  }
}
