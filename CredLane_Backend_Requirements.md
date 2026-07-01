**CredLane Employer Flow**

Backend Requirements Document

# **3\. Employer Verification and Trust Layer**

Verification is computed automatically based on criteria. No manual review or dedicated trigger endpoint is required. The system evaluates criteria on profile reads and profile updates and sets the verified flag accordingly.

## **3.1 Verification Criteria**

All three of the following must be true for verified: true to be set on the employer record:

* email\_verified is true

* company\_website is present and resolvable (DNS or HTTP check passes)

* linkedin\_url is present

## **3.2 GET /employer/verification-status**

* **Purpose:** Returns the employer's current verification status and the state of each individual criterion. Used to drive the persistent banner and profile completion prompt on the dashboard.

* **Auth:** JWT required, role: employer

Response fields:

* verified (boolean)

* criteria object containing: email\_verified (boolean), website\_resolvable (boolean), linkedin\_provided (boolean)

* banner\_visible (boolean) — true if verified is false

# **4\. Employer Profile**

## **4.1 GET /employer/profile**

* **Purpose:** Returns the employer's full profile for the edit state, including field-level lock metadata for restricted fields.

* **Auth:** JWT required, role: employer

Response includes all profile fields plus, for each restricted field (company\_name, company\_website, linkedin\_url):

* locked (boolean)

* last\_changed\_at (ISO timestamp or null)

* next\_editable\_at (ISO timestamp or null) — populated only when locked is true

## **4.2 PATCH /employer/profile**

* **Purpose:** Updates employer profile fields. Restricted and unrestricted fields are handled separately.

* **Auth:** JWT required, role: employer

Restricted fields: company\_name, company\_website, linkedin\_url

* These fields carry a 180-day cooldown enforced server-side using last\_changed\_at per field.

* If the field was changed within the last 180 days, return 403 with: "This field was last updated on \[date\] and can next be changed on \[date\]."

* If the change is permitted, update the field and record last\_changed\_at as the current timestamp.

Unrestricted fields: industry, company\_size, role\_tracks, experience\_levels

* These fields update immediately with no restriction check.

After any update, re-evaluate verification criteria and update the verified flag if the state has changed. Return 200 with the updated profile on success.

## **4.3 GET /employer/profile/public/:employer\_id**

* **Purpose:** Returns the talent-facing public profile card, shown whenever a candidate receives an offer or views the sender.

* **Auth:** JWT required (talent or employer)

Fields returned:

* company\_name

* verified (boolean, drives the verified badge display)

* new\_to\_platform (boolean) — computed at read time: account age less than 90 days AND hire\_count equals 0

* industry

* company\_size

* website\_url

* region

* linkedin\_url

* hire\_count — included only if at least one accepted offer exists on the account

* member\_since — human-readable string, e.g. "Member since March 2026"

# **5\. Dashboard**

## **5.1 GET /employer/dashboard**

* **Purpose:** Returns all data needed to render the employer dashboard. Response shape differs based on employer activity state.

* **Auth:** JWT required, role: employer

New user state (onboardingComplete: true, no prior activity):

* Return new\_user\_state: true flag

* Suppress stat cards

* No recent\_roles or recent\_activity

Existing user state (employer has activity):

* Return new\_user\_state: false

* verified\_talent\_count — total Job Ready candidates on the platform across all role tracks

* assessments\_shared\_count — total assessments the employer has sent

* shortlisted\_count — total candidates currently on the employer's shortlist

* roles\_count — total roles the employer has created

* recent\_roles — array of the 3 to 4 most recently created roles, each containing: role\_id, role\_title, assessment\_attached (boolean), offers\_sent (integer), status (active or closed)

* recent\_activity — array of the 3 most recent activity items, each containing: type, description, timestamp, and link to the relevant entity

Activity types for recent\_activity:

* assessment\_completion — e.g. "3 candidates completed Frontend Engineer assessment"

* new\_matching\_talent — e.g. "2 new verified Product Designers added"

* shortlist\_action — e.g. "You shortlisted \[Candidate Name\]"

* offer\_accepted

The profile completion progress bar percentage is derived from the verification-status endpoint and computed client-side. It does not require a separate field here.

# **6\. Roles**

## **6.1 GET /employer/roles**

* **Purpose:** Returns all roles created by the employer.

* **Auth:** JWT required, role: employer

* **Query params:** status (optional) — filter by active or closed

Each role entry returns: role\_id, role\_title, category, assessment\_attached (boolean), offers\_sent (integer), date\_created, status.

## **6.2 POST /employer/roles**

* **Purpose:** Creates a new role. Role creation is a multi-step flow but resolved in a single endpoint call once all steps are submitted.

* **Auth:** JWT required, role: employer

Request body:

* role\_title (required, string) — must be unique per employer account

* category (required, string)

* jd\_text (string, optional if jd\_file is provided)

* jd\_file (file upload, optional if jd\_text is provided)

* employment\_type (string)

* education (string)

* salary\_range (string)

* currency (string)

* assessment\_id (optional) — must belong to the employer's own account if provided

Company logo and company URL are pre-filled from the employer's profile server-side and are not accepted as request body fields.

Role is saved with status: active regardless of whether an assessment is attached. Return 201 with the created role object.

## **6.3 GET /employer/roles/:role\_id**

* **Purpose:** Returns full details for a single role.

* **Auth:** JWT required, role: employer

Returns all fields from the roles list plus full JD content and any attached assessment details.

## **6.4 PATCH /employer/roles/:role\_id**

* **Purpose:** Updates role details or attaches or replaces an assessment after creation.

* **Auth:** JWT required, role: employer

Accepts any subset of the role fields. assessment\_id can be updated to attach or replace an assessment. Role must belong to the requesting employer.

## **6.5 PATCH /employer/roles/:role\_id/close**

* **Purpose:** Closes a role. Closed roles cannot be used in the Send Offer flow and do not appear in the Select Role modal.

* **Auth:** JWT required, role: employer

Sets status: closed on the role record. Returns 200 on success. Returns 404 if the role does not belong to the employer.

## **6.6 PATCH /employer/roles/:role\_id/reopen**

* **Purpose:** Reopens a previously closed role.

* **Auth:** JWT required, role: employer

Sets status: active on the role record. Returns 200 on success.

## **6.7 GET /employer/roles/active**

* **Purpose:** Returns only the employer's active roles. Used exclusively to populate the Select Role modal during the Send Offer flow.

* **Auth:** JWT required, role: employer

Closed roles are excluded entirely. Returns role\_id, role\_title, category, and attached assessment details for each active role.

# **7\. Talents (Candidate Discovery)**

## **7.1 GET /employer/talents**

* **Purpose:** Returns a paginated, filterable list of Job Ready candidates. Only candidates with a composite score of 75 or above are returned under any condition.

* **Auth:** JWT required, role: employer

Query parameters:

* role\_track\[\] (multi-select)

* experience\_level\[\] (multi-select: Junior, Mid, Senior)

* score\_min (integer, minimum 75\)

* score\_max (integer, maximum 100\)

* availability\[\] (multi-select: Immediately Available, Open to Offers, Not Currently Looking)

* region (string)

* page (integer, default 1\)

* limit (integer, default 20\)

Response includes candidate cards and a total\_count field that reflects the current filtered result set. This drives real-time count updates as filters are applied.

Each candidate card returns: candidate\_id, first\_name, last\_name\_initial, role\_track, validated\_level, composite\_score, top\_skills (array of 2), availability\_status, region.

## **7.2 GET /employer/talents/:candidate\_id**

* **Purpose:** Returns the full verified candidate profile, opened on View Profile click.

* **Auth:** JWT required, role: employer

Fields returned:

* full\_name, validated\_level, composite\_score, role\_track, specialisation

* stage\_1\_summary — experience level, tools and stack, work preferences

* stage\_2\_result — validated level, skill breakdown

* stage\_3\_result — advanced assessment performance summary. Raw answers are never exposed.

* ai\_summary — 3 to 4 sentence AI-generated candidate summary

* availability\_status, region, linkedin\_url

* offer\_sent (boolean) — true if this employer has already sent an offer to this candidate. Used to replace the Send Offer button with an Offer Sent label on the frontend.

# **8\. Shortlist**

## **8.1 POST /employer/shortlist/:candidate\_id**

* **Purpose:** Adds a candidate to the employer's shortlist.

* **Auth:** JWT required, role: employer

Returns 201 on success. Returns 409 if the candidate is already shortlisted.

## **8.2 DELETE /employer/shortlist/:candidate\_id**

* **Purpose:** Removes a candidate from the employer's shortlist.

* **Auth:** JWT required, role: employer

Returns 200 on success. Returns 404 if the candidate is not on the shortlist.

## **8.3 GET /employer/shortlist**

* **Purpose:** Returns all shortlisted candidates in card format. Deactivated or removed candidate profiles are excluded silently — no error is returned for missing profiles.

* **Auth:** JWT required, role: employer

Returns the same card structure as GET /employer/talents. Supports View Profile navigation without returning to the Talents screen.

# **9\. Offers**

## **9.1 POST /employer/offers**

* **Purpose:** Sends an offer to a candidate for a specific role.

* **Auth:** JWT required, role: employer

Request body: candidate\_id (required), role\_id (required)

Validations:

* Employer must be verified (verified: true). If not, return 403\.

* Role must have status: active. If closed, return 400\.

* An offer must not already exist for this employer, candidate, and role combination. If a duplicate is detected, return 409\.

On success: create offer record with status: pending, trigger a notification to the candidate's CredLane account, and return 201 with a confirmation message: "Offer sent to \[Candidate First Name\]."

## **9.2 GET /employer/offers**

* **Purpose:** Returns all offers sent by the employer, used to populate the Offers Sent tab.

* **Auth:** JWT required, role: employer

Each offer entry returns: offer\_id, candidate\_name, role\_track, job\_title, date\_sent, status (Pending, Accepted, Declined). Accepted offers are included here with no separate tab needed on the backend.

## **9.3 GET /employer/offers/:offer\_id**

* **Purpose:** Returns a single offer in read-only mode.

* **Auth:** JWT required, role: employer

Returns full offer details including JD, employment type, education, salary range, and any attached assessment. Offer must belong to the requesting employer.

## **9.4 PATCH /employer/offers/:offer\_id/mark-hired**

* **Purpose:** Marks an accepted offer as a completed hire and increments the employer's public hire count.

* **Auth:** JWT required, role: employer

Validation: offer status must be accepted before this action is permitted. If status is not accepted, return 400\.

On success: set hired: true on the offer record and increment hire\_count on the employer record by 1\. Re-evaluate new\_to\_platform flag (hire\_count is now at least 1, so the label is removed regardless of account age). Return 200\.

# **10\. Assessments**

## **10.1 GET /employer/assessments**

* **Purpose:** Returns all assessments created by the employer.

* **Auth:** JWT required, role: employer

Each entry returns: assessment\_id, title, role\_track, experience\_level, time\_limit, passing\_threshold, question\_source, status (active or deactivated), submission\_count.

## **10.2 GET /employer/assessments/credlane-catalogue**

* **Purpose:** Returns CredLane's pre-built assessment catalogue for selection during assessment creation.

* **Auth:** JWT required, role: employer

Each catalogue item returns: assessment\_id, title, description, estimated\_completion\_time. For MVP, results are returned as a scrollable list. Search is not included.

## **10.3 POST /employer/assessments**

* **Purpose:** Creates a new assessment for the employer.

* **Auth:** JWT required, role: employer

Validations:

* Employer must be verified. If not, return 403\.

* Count active assessments on the employer's account. If active\_assessment\_count is 3 or more, return 403 with: "You have reached your active assessment limit. Deactivate an existing assessment to create a new one."

Request body:

* title (required)

* role\_track (required)

* experience\_level (required: Junior, Mid, or Senior)

* time\_limit (required: 20, 30, 40, or 60 minutes)

* passing\_threshold (required: integer between 50 and 90\)

* question\_source (required: credlane\_bank, manual, or admin\_upload)

If question\_source is credlane\_bank:

* credlane\_assessment\_id (required) — must exist in the CredLane catalogue

* Attach the selected pre-built assessment. No further question input is needed.

If question\_source is manual:

* questions\[\] (required) — minimum of 5 questions

* Each question requires: question\_text, question\_type (Multiple Choice, True/False, or Short Answer), options\[\] (required if Multiple Choice), correct\_answer

* Return 400 if fewer than 5 questions are provided

If question\_source is admin\_upload:

* Validate that the employer's pricing package includes this feature. If not, return 403 with an upgrade prompt.

* If the feature is unlocked, create a pending assessment record and dispatch a notification to the CredLane admin team. Admin uploads the question set within 24 hours. Questions become editable by the employer once loaded.

On success: return 201 with the created assessment object.

## **10.4 GET /employer/assessments/:assessment\_id**

* **Purpose:** Returns assessment details and the results table for all candidates who have submitted.

* **Auth:** JWT required, role: employer

* **Query params:** result (optional) — filter by pass or fail

Results table per candidate: candidate\_name, score, pass\_fail (evaluated server-side against the assessment's passing\_threshold), time\_taken, date\_completed.

Raw candidate answers are never returned. Only aggregate performance data is exposed.

## **10.5 PATCH /employer/assessments/:assessment\_id/deactivate**

* **Purpose:** Deactivates an assessment, freeing up a slot in the employer's active assessment count.

* **Auth:** JWT required, role: employer

Sets status: deactivated on the assessment record. The assessment is no longer counted toward the active limit. Returns 200 on success.

## **10.6 POST /employer/assessments/:assessment\_id/send**

* **Purpose:** Sends an assessment to one or more candidates.

* **Auth:** JWT required, role: employer

Request body: candidate\_ids\[\] (required, array)

Validations:

* Assessment must have status: active

* Employer must be verified

* Each candidate\_id must correspond to a verified CredLane talent account. Non-verified or non-existent candidates are rejected. External sharing via link is not supported.

On success: send an in-platform notification to each valid candidate's CredLane account. Return 200 with a summary of how many candidates were successfully sent the assessment.

# **11\. Notifications**

## **11.1 GET /employer/notifications**

* **Purpose:** Returns all notifications for the employer.

* **Auth:** JWT required, role: employer

Each notification returns: notification\_id, type, message, timestamp, read (boolean), link to the relevant candidate, offer, or assessment result.

Notification types:

* offer\_accepted

* offer\_declined

* new\_matching\_talent — delivered as a weekly batch, not per individual candidate

* assessment\_completed — delivered as a daily digest, not per individual submission

## **11.2 PATCH /employer/notifications/:notification\_id/read**

* **Purpose:** Marks a single notification as read.

* **Auth:** JWT required, role: employer

Returns 200 on success. Returns 404 if the notification does not belong to the employer.

## **11.3 PATCH /employer/notifications/read-all**

* **Purpose:** Marks all of the employer's notifications as read in a single call.

* **Auth:** JWT required, role: employer

Returns 200 on success.

# **12\. Account Settings**

## **12.1 PATCH /employer/settings/change-password**

* **Purpose:** Changes the employer's password. Applies to email/password accounts only.

* **Auth:** JWT required, role: employer

Request body: current\_password, new\_password, confirm\_new\_password.

Validations: current\_password must match the stored hash. new\_password and confirm\_new\_password must match. Return 400 if validation fails. Return 200 on success.

## **12.2 POST /employer/settings/change-email**

* **Purpose:** Initiates an email address change. Sends an OTP to the new email address.

* **Auth:** JWT required, role: employer

Request body: new\_email.

The existing email remains active until the OTP on the new email is verified. Return 200 on successful OTP dispatch.

## **12.3 POST /employer/settings/change-email/verify**

* **Purpose:** Confirms the OTP sent to the new email. Email is updated only after successful verification.

* **Auth:** JWT required, role: employer

Request body: new\_email, otp.

Validations: OTP must match and be within the validity window. On success, update work\_email on the employer record and return 200\. On failure, return 400\.

## **12.4 DELETE /employer/settings/account**

* **Purpose:** Permanently deletes the employer account. This action is irreversible.

* **Auth:** JWT required, role: employer

The frontend is responsible for requiring typed confirmation before the request is dispatched. The backend performs the deletion on receipt and returns 200\. No recovery path exists after this call.

# **13\. General Notes**

* All protected endpoints require a valid JWT with role: employer.

* Employer verification status (verified: true) is required for sending offers, creating assessments, and sending assessments to candidates.

* The 180-day cooldown on restricted profile fields (company\_name, company\_website, linkedin\_url) is enforced server-side using a last\_changed\_at timestamp stored per field.

* Pagination default is 20 items per page across all list endpoints.

* Soft deletion (deactivation) is used for assessments. Hard deletion is reserved for account removal only.

* The new\_to\_platform label is computed at read time: account age less than 90 days AND hire\_count equals 0\.

* hire\_count is incremented only via the mark-hired action on an accepted offer — not automatically on offer acceptance.

* Assessment results never expose raw candidate answers to employers. Only scores, pass/fail status, and time taken are returned.

* Active assessment count is evaluated at the time of each POST /employer/assessments call. Deactivated assessments do not count toward the limit.

* Accepted offers surface in three places: the Offers Sent tab, notifications, and the recent activity feed on the dashboard. The backend activity log must write an offer\_accepted event that is picked up by all three consumers.