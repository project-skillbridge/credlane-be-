import { resolveTrackFromRoleCode } from '../../../database/import/role-code-map';
import type { PersonalAssessmentQuestionImportItem } from './personal-assessment-question-import.types';

export type PersonalAssessmentQuestionImportRow = PersonalAssessmentQuestionImportItem & {
  id: string;
  track: string;
  options: { value: string; label: string }[] | null;
};

export function expandPersonalAssessmentImportItems(
  item: PersonalAssessmentQuestionImportItem,
): PersonalAssessmentQuestionImportRow[] {
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
      id: `${item.id}__${roleCode}`,
      track: resolveTrackFromRoleCode(roleCode),
      options: variant.options,
    });
  }

  return rows;
}
