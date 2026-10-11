# CELE · The Engineer’s Atlas

A static, browser-local Civil Engineering skill-tree skeleton. One curriculum graph contains shared technical courses and all five specialization branches. Quizzes and course descriptions are intentionally deferred.

Run `npm test`, `npm run build`, then `npm start`. Open http://127.0.0.1:4173.

## Architecture

- `src/curriculum.mjs`: shared course identities, ID122 term placement and H/S/C prerequisites, specialization metadata, configurable required mastery scope, and common CELE review groupings.
- `src/progression.mjs`: immutable progression transitions. Preview is read-only; specialist progression requires confirmed self-reported acceptance; a separate confirmed transfer transition retains all records. Academic and mastery completion are separate. CIVINCO requires the active technical path, configured mastery, then a common assessment pass.
- `src/storage.mjs`: versioned local persistence and record hydration. Export a JSON backup from the journal. No university enrollment integration or server accounts.
- `src/app.js`: independent map state for browsing years, branches, pan and zoom. Actual academic year is self-reported separately in the journal. Unselected branches and explicit Explore All mode disable ordinary progression actions.
- `tests/progression.test.mjs`: required V3 regression cases plus dependency enforcement, storage round trips and mastery/gate separation.

## Curriculum scope

Transcribed from the five supplied DLSU AY2022–2023 ID122 checklists. Only technical courses are modeled; GE, PE, NSTP and OJT are excluded from the app’s technical progress denominator. CIVINCO is a common integration gate outside the course denominator. Shared Urban Engineering (CESPECS) remains shared because it appears in all five checklists. Specialist lecture courses are required mastery nodes when selected; laboratories are academic requirements only. This scope can be changed in `MASTERY_SCOPE` and course `requiredMastery` fields.

H prerequisites require academic completion, S prerequisites require an activated or completed record, and C co-requisites require activation or completion. This skeleton uses self-reported app records; it does not assert enrollment or university verification. Quizzes have service boundaries and historical record storage but no user-facing assessment content yet. Hardmode uses configurable common domain groupings, with review content deferred. A recorded CIVINCO pass remains valid through a transfer; active-path eligibility is recalculated separately.

All progress resides in the current browser. Export preserves the full progression record. Backup import and account synchronization are future work. Assets are original inline SVG drawings; the serif and sans typography use Google Fonts with local fallbacks.
