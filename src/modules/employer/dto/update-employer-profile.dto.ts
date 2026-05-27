import { PartialType } from '@nestjs/swagger';
import { SaveEmployerProfileDto } from './save-employer-profile.dto';

export class UpdateEmployerProfileDto extends PartialType(
  SaveEmployerProfileDto,
) {}
