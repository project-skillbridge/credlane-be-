import { ApiProperty } from '@nestjs/swagger';
import { EmployerProfile } from '../entities/employer-profile.entity';

export class RestrictedFieldMetadataDto {
  @ApiProperty()
  locked: boolean;

  @ApiProperty({ nullable: true })
  last_changed_at: string | null;

  @ApiProperty({ nullable: true })
  next_editable_at: string | null;
}

export class EmployerRestrictedFieldsDto {
  @ApiProperty({ type: RestrictedFieldMetadataDto })
  company_name: RestrictedFieldMetadataDto;

  @ApiProperty({ type: RestrictedFieldMetadataDto })
  company_website: RestrictedFieldMetadataDto;

  @ApiProperty({ type: RestrictedFieldMetadataDto })
  linkedin_url: RestrictedFieldMetadataDto;
}

export class EmployerProfileResponseDto extends EmployerProfile {
  @ApiProperty({ type: EmployerRestrictedFieldsDto })
  restricted_fields: EmployerRestrictedFieldsDto;
}
