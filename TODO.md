Issue 1 — Engagement Page
New admin sub-module at src/modules/admin/engagement/, following the established pattern from 
admin-overview
.

[NEW] 
admin-engagement.module.ts
NestJS module registering TypeOrmModule.forFeature([ AssessmentAttempt, AssessmentResult, TalentProfile ]), the controller, and the service.

[NEW] 
admin-engagement.controller.ts

@ApiTags('admin-engagement')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
@Controller('admin/engagement')
Endpoint	Method	Summary
/admin/engagement/stats	GET	Engagement stat cards (row of 4)
/admin/engagement/retake-dropoff	GET	Chart 1 — Retake Drop-off by Attempt Number
/admin/engagement/minor-uptake	GET	Chart 2 — Minor Assessment Uptake by Type
[NEW] 
admin-engagement.service.ts
getStats() → EngagementStats

Returns 4 stat cards with trend indicators (reuses the StatCard / TrendIndicator interfaces from admin-overview):

Stat	Source	Logic
minor_assessment_adoption_rate	No minor assessment entity yet	Stub: returns { value: 0, trend: null }.
minor_assessment_completion_rate	No minor assessment entity yet	Stub: returns { value: 0, trend: null }.
retake_conversion_rate	assessment_attempts	Count distinct talent_profile_ids with ≥2 attempts of type advanced / count with ≥1 attempt. Trending vs prior 30d.
avg_time_to_retake_days	assessment_attempts + talent_profiles	For each talent with consecutive advanced attempts where a gate was active (assessment_locked_from → next attempt's started_at), compute the average delta in days. Null trend if insufficient data.
getRetakeDropoff() → RetakeDropoffResult

typescript

interface RetakeDropoffResult {
  buckets: { attempt_number: number; count: number }[];  // attempt 1, 2, 3, ...
  total_candidates_with_attempts: number;
  empty: boolean;       // true when fewer than 10 candidates have attempts
  empty_message: string | null;  // "Not enough retake data yet."
}
Query: Group assessment_attempts (type=advanced, completed_at IS NOT NULL) by talent_profile_id, rank by started_at, then count how many candidates reached attempt N. Returns bar chart data showing drop-off.

getMinorUptake(track?: string) → MinorUptakeResult

typescript

interface MinorUptakeResult {
  buckets: { type: string; count: number }[];
  // type = 'language_variant' | 'specialisation_deep_dive' | 'soft_skill'
  empty: boolean;
  empty_message: string | null;  // "No minor assessment data yet."
}
Stub — returns { buckets: [], empty: true, empty_message: "No minor assessment data yet." }. The track query param is accepted now so the FE can wire the dropdown, but it has no effect until the minor assessment entity exists.

[x] 
dto/minor-uptake-query.dto.ts
typescript

export class MinorUptakeQueryDto {
  @IsOptional() @IsString()
  track?: string;
}
[x] 
admin-engagement.service.spec.ts
Unit tests covering:

getStats() — stubs return zero values; retake conversion with mock data returns correct %
getRetakeDropoff() — empty state when <10 candidates; correct bucket counts with mock data
getMinorUptake() — always returns empty stub

- [x] Create `dto/admin-offers-stats-query.dto.ts`
- [x] Create `dto/admin-list-offers-query.dto.ts`
- [x] Create `admin-offers.service.ts` (stats, funnel, findAll)
- [x] Create `admin-offers.controller.ts`
- [x] Create `admin-offers.module.ts`
- [x] Create `admin-offers.service.spec.ts`
- [x] Wire `AdminOffersModule` into `app.module.ts`
- [x] Verify build (`pnpm build`)
- [x] Run unit testsake conversion with mock data returns correct %
getRetakeDropoff() — empty state when <10 candidates; correct bucket counts with mock data
getMinorUptake() — always returns empty stub