import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AiResourcesService } from './ai-resources.service';

@ApiTags('ai-resources')
@ApiCookieAuth()
@Controller('talent/resources')
@Roles(UserRole.TALENT)
export class AiResourcesController {
  constructor(private readonly aiResourcesService: AiResourcesService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve personalized learning resources',
    description:
      "Fetches learning resources (articles, courses, videos) curated specifically to the user's track and latest assessment score threshold.",
  })
  @ApiOkResponse({
    description: 'Personalized resources successfully retrieved',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiUnprocessableEntityResponse({
    description:
      'Candidate has not completed any assessments yet, or has no track assigned.',
  })
  async getResources(@CurrentUser('sub') userId: string) {
    return this.aiResourcesService.getResourcesForUser(userId);
  }
}
