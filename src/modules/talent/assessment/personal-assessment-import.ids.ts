export const PERSONAL_ASSESSMENT_QUESTION_ID_MAX_LENGTH = 50;
export const PERSONAL_ASSESSMENT_ROLE_CODE_MAX_LENGTH = 20;
const VARIANT_ID_SEPARATOR = '__';
const ROLE_CODE_PATTERN = /^[A-Za-z0-9_]+$/;

export function assertImportQuestionId(id: string): void {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new Error('Question id must not be empty');
  }
  if (trimmed.length > PERSONAL_ASSESSMENT_QUESTION_ID_MAX_LENGTH) {
    throw new Error(
      `Question id "${trimmed}" exceeds ${PERSONAL_ASSESSMENT_QUESTION_ID_MAX_LENGTH} characters`,
    );
  }
}

export function buildVariantQuestionId(
  baseId: string,
  roleCode: string,
): string {
  const base = baseId.trim();
  assertImportQuestionId(base);

  const code = roleCode.trim();
  if (!code) {
    throw new Error('Track variant role code must not be empty');
  }
  if (code.length > PERSONAL_ASSESSMENT_ROLE_CODE_MAX_LENGTH) {
    throw new Error(
      `Role code "${code}" exceeds ${PERSONAL_ASSESSMENT_ROLE_CODE_MAX_LENGTH} characters`,
    );
  }
  if (!ROLE_CODE_PATTERN.test(code)) {
    throw new Error(
      `Role code "${code}" must contain only letters, numbers, and underscores`,
    );
  }

  const variantId = `${base}${VARIANT_ID_SEPARATOR}${code}`;
  if (variantId.length > PERSONAL_ASSESSMENT_QUESTION_ID_MAX_LENGTH) {
    throw new Error(
      `Variant id "${variantId}" exceeds ${PERSONAL_ASSESSMENT_QUESTION_ID_MAX_LENGTH} characters (base id is ${base.length} characters)`,
    );
  }

  return variantId;
}
