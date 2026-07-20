import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
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
import { TalentExploreJobsService } from './talent-explore-jobs.service';

@ApiTags('Talent Explore Jobs')
@ApiBearerAuth()
@Roles(UserRole.TALENT)
@Controller('talent/explore-jobs')
export class TalentExploreJobsController {
  constructor(private readonly exploreJobsService: TalentExploreJobsService) {}

  @Get()
  @ApiOperation({ summary: 'List public roles matching the talent profile' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Public roles list' })
  listRoles(
    @CurrentUser('sub') talentUserId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.exploreJobsService.listRoles(talentUserId, page, limit);
  }

  @Get('weekly-cap')
  @ApiOperation({ summary: 'Return the talent weekly interested-click cap' })
  getWeeklyCap(@CurrentUser('sub') talentUserId: string) {
    return this.exploreJobsService.getWeeklyCap(talentUserId);
  }

  @Post(':roleId/interested')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mark interest in a public role' })
  @ApiResponse({ status: 201, description: 'Interest recorded' })
  markInterested(
    @CurrentUser('sub') talentUserId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.exploreJobsService.markInterested(talentUserId, roleId);
  }
}
