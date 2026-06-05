import { ApiProperty } from '@nestjs/swagger';

export class EmployerVerificationCriteriaDto {
  @ApiProperty()
  email_verified: boolean;

  @ApiProperty()
  website_resolvable: boolean;

  @ApiProperty()
  linkedin_provided: boolean;
}

export class EmployerVerificationStatusResponseDto {
  @ApiProperty()
  verified: boolean;

  @ApiProperty({ type: EmployerVerificationCriteriaDto })
  criteria: EmployerVerificationCriteriaDto;

  @ApiProperty({
    description: 'Whether the verification prompt banner should be shown',
  })
  banner_visible: boolean;
}
