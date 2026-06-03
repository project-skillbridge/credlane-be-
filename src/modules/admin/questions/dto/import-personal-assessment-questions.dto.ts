import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const PERSONAL_ASSESSMENT_IMPORT_FORMATS = [
  'single_select',
  'multi_select',
  'text_required',
  'text_optional',
] as const;

export class PersonalAssessmentQuestionOptionDto {
  @ApiProperty({ example: 'fully_remote' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ example: 'Fully remote, no office' })
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class PersonalAssessmentQuestionImportItemDto {
  @ApiProperty({ example: 'PA-GEN-WST-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id: string;

  @ApiProperty({ example: 'work_style' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  section: string;

  @ApiProperty({ example: 'all' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  track: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'work_arrangement', name: 'field_name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({
    example: 'single_select',
    enum: PERSONAL_ASSESSMENT_IMPORT_FORMATS,
  })
  @IsIn([...PERSONAL_ASSESSMENT_IMPORT_FORMATS])
  format: (typeof PERSONAL_ASSESSMENT_IMPORT_FORMATS)[number];

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiProperty({ type: [PersonalAssessmentQuestionOptionDto], required: false })
  @ValidateIf((item: PersonalAssessmentQuestionImportItemDto) =>
    ['single_select', 'multi_select'].includes(item.format),
  )
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonalAssessmentQuestionOptionDto)
  options?: PersonalAssessmentQuestionOptionDto[];
}

export class ImportPersonalAssessmentQuestionsDto {
  @ApiProperty({ type: [PersonalAssessmentQuestionImportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PersonalAssessmentQuestionImportItemDto)
  questions: PersonalAssessmentQuestionImportItemDto[];
}
