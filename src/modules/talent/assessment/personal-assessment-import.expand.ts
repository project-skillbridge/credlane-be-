import { resolveTrackFromRoleCode } from '../../../database/import/role-code-map';
import {
  assertImportQuestionId,
  buildVariantQuestionId,
} from './personal-assessment-import.ids';
import type { PersonalAssessmentQuestionImportItem } from './personal-assessment-question-import.types';

export type PersonalAssessmentQuestionImportRow = Omit<
  PersonalAssessmentQuestionImportItem,
  'options'
> & {
  options: { value: string; label: string }[] | null;
};

export function expandPersonalAssessmentImportItems(
  item: PersonalAssessmentQuestionImportItem,
): PersonalAssessmentQuestionImportRow[] {
  assertImportQuestionId(item.id);

  const variantEntries = item.trackVariants
    ? Object.entries(item.trackVariants)
    : [];
  const rows: PersonalAssessmentQuestionImportRow[] = [];

  if (item.options?.length) {
    rows.push({
      ...item,
      id: item.id,
      track: item.track,
      options: item.options,
    });
  } else if (
    (item.format === 'text_required' || item.format === 'text_optional') &&
    variantEntries.length === 0
  ) {
    rows.push({
      ...item,
      id: item.id,
      track: item.track,
      options: null,
    });
  }

  for (const [roleCode, variant] of variantEntries) {
    rows.push({
      ...item,
      id: buildVariantQuestionId(item.id, roleCode),
      track: resolveTrackFromRoleCode(roleCode),
      options: variant.options,
    });
  }

  return rows;
}
