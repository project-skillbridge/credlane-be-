/** Maps 3-letter role codes from question bank JSON to platform track slugs. */
export const ROLE_CODE_TO_TRACK: Record<string, string> = {
  FED: 'frontend_developer',
  BED: 'backend_developer',
  MOB: 'mobile_developer',
  FSD: 'fullstack_developer',
  DEV: 'cloud_devops',
  DTE: 'data_engineer',
  QAE: 'quality_assurance',
  MLE: 'ml_engineer',
  PMG: 'product_manager',
  PDG: 'product_designer',
  UXR: 'ux_researcher',
  BRD: 'brand_designer',
  GRM: 'marketing',
  CTM: 'marketing',
  SMM: 'marketing',
  PFM: 'marketing',
  DTA: 'data_analyst',
  BIA: 'business_analyst',
  BID: 'bi_developer',
  DSC: 'data_scientist',
  OPM: 'operations_manager',
  CSM: 'customer_success',
  PJM: 'project_manager',
  HRO: 'hr_people_ops',
  CYB: 'cybersecurity',
};

export function resolveTrackFromRoleCode(
  roleCode: string | null | undefined,
): string {
  if (!roleCode) {
    return 'general';
  }
  return ROLE_CODE_TO_TRACK[roleCode.toUpperCase()] ?? roleCode.toLowerCase();
}
