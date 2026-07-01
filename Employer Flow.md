**CredLane Employer Flow**

*Finalized Product Requirements*

**Entry Points**

* Returning employers land on /auth/signin?user=employer

* New employers land on the employer registration screen

* Both screens offer email/password and Continue with Google

* Password reset applies to email/password accounts only; redirects to employer login on completion

* Google-authenticated employers have no password reset path

**Employer Registration: Email/Password**

* Sign up fields: full name, work email, password, confirm password

* A 6-digit OTP is sent automatically on successful registration

* OTP is valid for 5 minutes; expired codes are rejected

* Maximum of 3 attempts on OTP submission with rate-limited resend and invalidation of the previous OTP

* Unverified accounts are blocked at login

* JWT is issued at login only, not at registration or OTP verification

* Role is set as employer and carried through routing logic

* If the email already exists as a talent account, the system rejects with: "This email is already registered."

**Employer Registration: Google OAuth**

* Employer clicks Continue with Google on the sign-up screen

* Google consent screen is presented; the platform receives name and email on approval

* Account is created with role set to employer and is\_verified set to true

* OTP verification is skipped entirely

* If the email already exists as a talent account, the system rejects with: "This email is registered under a different account type."

**Employer Login: Google OAuth**

* If the email matches an existing verified employer account, JWT is issued and routing applies

**Post-Login Routing**

* Employer with onboardingComplete: false is routed to employer onboarding

* Employer with onboardingComplete: true is routed to the discovery dashboard

* JWT carries role: employer and is\_verified: true

**Employer Onboarding**

**Step 1: About You and Your Company**

* Fields: I am joining as (required, single select), company name (required), company website (required), industry (required), company size (required), region (required), LinkedIn company page URL (optional)

* Next button is inactive until all required fields are filled

**Step 2: Hiring Preferences**

* Fields: role tracks looking to hire for (required), preferred experience levels (required), how many talents are you looking to hire (optional)

* Next button is inactive until role tracks and experience levels are filled

**Step 3: Setting Up Your Dashboard**

* Loading screen with spinner

* Auto-navigates to discovery dashboard on completion

* Retry option shown on error

**Navigation: Top Bar**

* Overview

* Talents

* Assessments

* Shortlist

* Profile dropdown:Notifications, Settings, Logout

**Employer Verification and Trust Layer**

* Verification is criteria-based; no manual review required

* Verified badge is awarded when all of the following are met:

  * Work email verified

  * Company website URL provided and resolvable

  * LinkedIn company page URL provided

* Verified badge is shown on the employer's public profile card and on every offer card a candidate receives

* Employers who have not completed verification can browse the dashboard but cannot send offers or generate assessment links

* The Send Offer button is present but inactive for unverified accounts. Clicking it surfaces a modal explaining why the action is unavailable and prompting the employer to complete verification 

* Hire count is tracked per employer account and shown publicly on their profile card once at least one offer has been accepted

* New to Platform label is shown on the employer profile card if the account is less than 90 days old and hire count is zero

**Employer Public Profile: Talent-Facing View**

* Shown to candidates whenever they receive an offer or view who sent it

* Contains:

  * Company name

  * Verified badge

  * New to Platform label if applicable

  * Industry

  * Company size

  * Website URL (opens in new tab)

  * Region

  * LinkedIn company page URL (opens in new tab)

  * Hire count once at least one accepted offer exists

  * Account age in human-readable format (e.g. "Member since March 2026")

**Overview: New User Dashboard**

* Header shows: "Welcome, \[Company Name\]. Start discovering verified talent."

* Subline directs employer to browse top Job Ready talents who have completed the assessment roadmap

* A "Complete your profile" prompt is shown persistently in the top right of the dashboard header until verification criteria are met, linking directly to the employer profile edit flow

* The hero section contains a platform value proposition headline and two primary CTAs side by side:

  * Explore verified talent — links to Talents screen

  * Create a role — links to role creation flow

* Below the hero, a social proof strip shows the total talent pipeline count and employer testimonial cards. This is marketing-facing content shown only on the new user state. Testimonial content is managed, not dynamic.

* Below social proof, a "What you can do on CredLane" section shows three feature tiles, each with a short description and a text CTA:

  * Discover verified talents — links to Talents screen

  * Create and Share assessments — links to Assessments screen

  * Manage your shortlist — links to Shortlist screen

**Overview: Existing User Dashboard**

* Header shows: "Welcome back, \[Company Name\]."

* Subline: "Browse through top Job Ready talents who have completed our assessment roadmap."

* A "Complete your profile" progress bar is shown persistently in the top right of the dashboard header displaying percentage completion. It remains visible until all verification criteria are met and profile fields are filled.

* Four stat cards displayed in a 2x2 grid:

  * Verified Talent: total Job Ready candidates on the platform across all role tracks — CTA: Browse talents, links to Talents screen. Supporting line: "Candidates across engineering, design, product, and cloud roles."

  * Assessments Shared: total assessments the employer has sent — CTA: View assessment, links to Assessments screen. Supporting line: "Track candidate submissions and review performance in one place."

  * Shortlisted Candidates: total candidates currently saved to the employer's shortlist — CTA: View shortlist, links to Shortlist screen. Supporting line: "Candidates saved for interviews or next review."

  * My Roles: total number of roles the employer has created — CTA: View roles, links to full roles page. Supporting line: "Top candidates aligned with your hiring requirements."

* A "+ Create a Role" button is available in the top right corner of the dashboard header at all times

* Recent Activity section shows the 3 most recent items with a "See all" link. Each item has a type icon and a timestamp. Activity types include:

  * New verified talent matching hiring preferences — e.g. "2 new verified Product designers added"

  * Shortlist actions taken by the employer — e.g. "You shortlisted \[Candidate Name\]"

  * Offers accepted by candidates

**Roles: Full Roles Page**

* Accessible by clicking "View all" from the dashboard My Roles section

* Shows all roles the employer has created

* Each role entry shows: role title, category, assessment attached (or none), number of offers sent, date created, status (active or closed)

* Employer can open a role to view its full details

* Employer can close a role at any time when they feel they have found their pick or no longer need candidates for that role

* Closed roles are moved to a separate Closed tab and can no longer be used to send new offers

* Employer can reopen a closed role if needed

* Empty state: "No roles created yet. Create your first role to start sending offers."

**Create New Role Flow**

* Triggered from three places: the new user dashboard CTA, the existing user dashboard "+ Create a Role" button, and inline during the Send Offer flow

**Step 1: Role Identity Modal**

* A modal opens with the following fields:

  * Company name — pre-filled from employer profile, read-only

  * Company URL — pre-filled from employer profile, read-only

  * Role title — employer fills in (required, unique to each role)

  * Category — employer fills in (required, unique to each role)

* Employer clicks Continue to proceed. Pre-filled fields cannot be edited in this modal.

**Step 2: Role Details**

* Full role form fields:

  * Upload JD (file upload or paste text)

  * Employment type

  * Education

  * Keyword

  * Salary range

  * Currency

**Step 3: Attach Assessment (Optional)**

* Employer picks from assessments already created and sitting in their account

* A modal opens showing the employer's existing assessments as scrollable cards

* Each card shows: assessment title, description, estimated completion time

* Employer selects one via toggle and confirms

* If the employer skips this step, the role is still saved and an assessment can be attached later from the roles page

* Role is saved automatically once the employer completes the form whether or not an assessment is attached

**Talents Screen**

* This is where employers browse, filter, view profiles, shortlist candidates, and send offers

* Only Job Ready candidates (score 75 and above) are visible under any condition

**Filter Panel — Left Sidebar**

* Role Track (multi-select, matches role tracks from talent onboarding)

* Experience Level (multi-select: Junior, Mid, Senior)

* Score Range (slider: 75 to 100\)

* Availability (multi-select: Immediately Available, Open to Offers, Not Currently Looking)

* Region (Africa-wide by default, country-level filter options)

* Apply and Clear All actions available

* Active filters shown as removable chips

* Total visible candidate count updates in real time as filters are applied

**Candidate Card Grid**

* Each card shows: first name and last name initial, role track and validated level badge, composite score ring, top 2 verified skills, region, View Profile button, Shortlist button

* Cards are paginated at 20 per page

* Skeleton loaders shown during fetch

* Empty state: "No candidates match your current filters. Try adjusting your selection."

**Candidate Verified Profile**

* Opens on View Profile click as a dedicated page

* Contains: full name, validated level badge, composite score ring, role track and specialisation, Stage 1 summary (experience level, tools and stack, work preferences), Stage 2 result (validated level, skill breakdown bars), Stage 3 result (advanced assessment performance summary, no raw answers shown), AI-generated candidate summary (3 to 4 sentences), availability status, region, LinkedIn URL if provided

* The Shortlist button and Send Offer button are both present on this view

* If an offer has already been sent to this candidate, the Send Offer button is replaced with an Offer Sent label

**Send Offer Flow**

* Employer clicks Send Offer on a candidate's verified profile

* For unverified employers, the Send Offer button is present but inactive. Clicking it surfaces a modal explaining why the action is unavailable and prompting the employer to complete verification 

* Employers can select multiple candidates via checkbox and send an offer to all selected at once. Bulk offer sending is supported from the Shortlist screen 

* A Select Role modal opens showing all the employer's active created roles

* Employer picks the relevant role or creates a new one on the spot

* Any role created at this point is saved automatically and appears in My Roles page

* The offer form opens pre-populated with the selected role's details: JD, employment type, education, salary range, assessment attached

* Employer reviews the details and clicks Send Offer

* A confirmation modal appears before the offer goes out

* Confirmation toast shown after sending: "Offer sent to \[Candidate First Name\]."

* If an offer has already been sent to this candidate, the Send Offer button is replaced with an Offer Sent label

* Only active roles appear in the Select Role modal; closed roles do not appear

**Offer Lifecycle**

* Offer sent → Pending: employer sends an offer to a candidate. Offer sits in Pending until the candidate responds. Employer can withdraw at this stage

* Pending → Assessment Unlocked: candidate accepts the offer. This triggers the assessment attached to the role. The assessment window opens at a platform default of 5 days. Declining at this stage skips everything and closes the offer

* Assessment Unlocked → Assessment Completed: candidate completes the assessment within the window. Score is calculated immediately. If the candidate does not complete within 5 days, the employer is notified and offered a single one-time extension of 2 to 3 days. If the extension window also lapses without completion, the offer moves to Expired

* Assessment Completed → Pass or Fail: score is evaluated automatically against the employer's set passing threshold. If the candidate fails, the offer closes automatically, the candidate is notified, and the result remains visible in the employer's assessment results dashboard. If the candidate passes, both the employer and candidate are notified of the score immediately

* Pass → Accepted or Declined: only candidates who pass reach this stage. The candidate makes their final decision. This is the only point where the candidate has agency over the outcome

* For roles with no assessment attached, the offer moves directly from Pending to Accepted or Declined with no intermediate states

Full status map: Pending, Assessment Unlocked, Assessment Completed, Passed, Failed, Accepted, Declined, Expired

**Assessment Generation and Sharing**

* Accessible from the Assessments tab in the top navigation

* Only available to verified premium employers

* Each employer account can have up to 5 active assessments at the same time in MVP

* When the limit is reached, the Create Assessment button is disabled with a tooltip: "You have reached your active assessment limit. Deactivate an existing assessment to create a new one."

* Assessment delivery is not a standalone action. Assessments are attached to roles and delivered automatically as part of the offer flow. The Assessments tab covers creation, configuration, question source, and results only 

**Assessment Configuration Fields**

* Assessment title (required)

* Role track (required, single select)

* Experience level (required: Junior, Mid, Senior)

* Time limit (dropdown: 20, 30, 40, 60 minutes)

* Passing threshold (slider: 50 to 90\)

**Question Source**

* Employer selects one of two options presented as radio buttons or selectable cards:

**Use CredLane Question Bank**

* A modal opens showing CredLane's catalogue of pre-built assessments as scrollable cards

* Each card shows: assessment title, short description, estimated completion time

* Employer selects via toggle and confirms with the Add assessment button

* The selected assessment is attached and no further question input is needed

* For MVP, assessments are browsed by scroll. Search is not included in MVP and will be revisited when the catalogue grows large enough to require it.

**Add My Own Questions**

* This selection expands the question builder inline below

* Employer then sees two options, also as inline expandable selections:

**Enter Manually**

* Add Question button appends a new question entry

  * Each entry has: question text field, question type (Multiple Choice, True/False, Short Answer), answer options where applicable, correct answer designation

  * Employer can reorder questions via drag and drop

  * Employer can delete individual questions

  * Running question count shown, e.g. "8 questions added."

  * Minimum of 5 questions required before the assessment can be saved

**Upload via Admin**

* Employer submits their question set to the CredLane team through the platform

  * The admin team formats and loads the questions into the employer's account within 24 hours

  * This is a paid feature and must be part of the employer's active pricing package

  * Employers without this feature unlocked see a prompt to upgrade

  * Once uploaded by the admin team, questions appear in the employer's assessment builder and can be reviewed and edited before the assessment is saved

**Assessment Results Dashboard**

* Accessible by clicking into any assessment from the Assessments tab

* Results table shows per candidate: candidate name, score, pass or fail status against the employer-set threshold, time taken, date completed

* Employer can filter results by pass or fail

* Employer can click through to a candidate's full CredLane profile

* Empty state before any submissions: "No submissions yet. Send your assessment to candidates to get started."

* Empty state on Assessments tab before any assessment is created: "No assessments yet. Create your first assessment to start screening candidates."

**Shortlist Screen**

* Two tabs: My Shortlist and Offers Sent

**My Shortlist Tab**

* Shows all shortlisted candidates in the same card format as the Talents screen

* Remove from shortlist available on each card

* Employer can click View Profile from this view without going back to the Talents screen

* If a shortlisted candidate's profile is removed or deactivated, the card is removed silently

* Empty state: "No shortlisted candidates yet. Save candidates from the Talents screen."

**Offers Sent Tab**

* Each offer entry shows: candidate name and role track, job title sent, date sent, status tag (Pending, Accepted, Declined)

* Status tags are: Pending, Assessment Unlocked, Assessment Completed, Passed, Failed, Accepted, Declined, Expired 

* Accepted offers are visible here; no separate accepted tab

* View Offer button opens the offer in read-only mode

* Status updates in real time when candidates respond

* Employer can mark hire as complete on an accepted offer; this increments their public hire count on their employer profile

* Empty state: "No offers sent yet. Discover candidates and send your first offer."

**Notifications**

* Offer accepted by candidate and assessment has been unlocked

* Assessment window expiring in 24 hours with no submission

* Offer expired due to assessment window lapsing

* Candidate passed assessment threshold

* Candidate failed assessment threshold and offer has been closed

* Offer declined by a candidate

* New Job Ready candidates matching saved hiring preferences (weekly batch)

* Notification centre shows timestamp, notification type, and link to the relevant candidate, offer, or assessment result

**Employer Profile: Edit State**

**Restricted Fields — 180-Day Cooldown**

* Company name, website URL, and LinkedIn company page URL can only be changed once every 180 days

* These are the identity and trust signals that appear on the public employer profile and on every offer card a candidate sees

* When a restricted field was recently changed, it shows a lock state with the message: "This field was last updated on \[date\] and can next be changed on \[date\]."

**Unrestricted Fields — Editable Anytime**

* Industry, company size, and hiring preferences (role tracks and experience levels) can be updated at any time

* These fields do not affect how the employer appears to candidates in a trust sense

* Save Changes button; changes take effect immediately for unrestricted fields

* Restricted field changes take effect immediately but cannot be changed again for 180 days

**Settings and Account Management**

* Change password (current password required)

* Change work email (OTP verification on new email required before update takes effect)

* Delete account (confirmation modal with typed confirmation, irreversible)

* Logout accessible from profile dropdown and settings

**Edge Cases and Empty States**

* No candidates match filters: "No candidates match your current filters. Try adjusting your selection."

* Candidate profile removed or deactivated: card removed from grid, shortlist link shows 404 state

* Offer already sent: Send Offer replaced with Offer Sent label on that candidate's profile

* Employer account unverified: can browse dashboard but cannot send offers or generate assessments; Send Offer button is inactive and surfaces a verification modal on click 

* Employer reaches 5 active assessment limit: Create Assessment button disabled with tooltip shown

* No roles created yet: "No roles created yet. Create your first role to start sending offers."

* Closed role: cannot be used to send new offers, moved to closed tab, can be reopened

* Select Role modal during Send Offer: only active roles shown; closed roles do not appear

* Upload via admin feature not unlocked: employer sees upgrade prompt when attempting to select that option

* Restricted profile field recently changed: field shows lock state with next available change date

* Assessment window lapses without completion: offer moves to Expired automatically, employer is notified and offered a single one-time extension of 2 to 3 days before the offer closes

* Candidate fails assessment threshold: offer closes automatically, candidate is notified, result remains visible in the employer's assessment results dashboard

* Roles with no assessment attached: offer moves directly from Pending to Accepted or Declined with no intermediate states


