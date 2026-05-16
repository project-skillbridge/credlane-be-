import { ApiProperty } from '@nestjs/swagger';

export enum DashboardJourneyStatus {
  COMPLETE = 'complete',
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export class JourneyOverviewItemDto {
  @ApiProperty({ example: 'onboarding' })
  key: string;

  @ApiProperty({ example: 'Onboarding' })
  title: string;

  @ApiProperty({
    enum: DashboardJourneyStatus,
    example: DashboardJourneyStatus.COMPLETE,
  })
  status: DashboardJourneyStatus;
}

export class DashboardHomeResponseDto {
  @ApiProperty({ example: 'Jane' })
  firstName: string;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  profileCompletionPercentage: number;

  @ApiProperty({ type: [JourneyOverviewItemDto] })
  journeyOverview: JourneyOverviewItemDto[];
}

export type DashboardHomeResponse = {
  firstName: string;
  profileCompletionPercentage: number;
  journeyOverview: JourneyOverviewItemDto[];
};
