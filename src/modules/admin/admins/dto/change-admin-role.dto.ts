import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AdminTier } from '../../../users/entities/user.entity';

export class ChangeAdminRoleDto {
  @ApiProperty({
    enum: AdminTier,
    example: AdminTier.ADMIN,
    description: 'New admin tier for the account',
  })
  @IsEnum(AdminTier)
  role: AdminTier;

  @ApiPropertyOptional({
    description: 'Required when downgrading a Super Admin to Admin or Reviewer',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  confirm_downgrade?: boolean;
}
