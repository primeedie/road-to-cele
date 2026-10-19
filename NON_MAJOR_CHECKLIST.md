# Non-major checklist provenance and behavior

This is a separate, self-reported checklist. It does not modify the ID122 technical curriculum, academic standing, prerequisite checks, mastery, cosmetic milestones or CIVINCO eligibility. Courses appear in one list, with no prescribed year or term. Each row saves Year Taken (1–6), local Term 1–3 and an explicit Taken checkbox. A complete date enables the checkbox; clearing either date unchecks that row.

## Owner-supplied sources (private PDFs; do not publish)

- `CIV_HWR Checklist ID122 (2).pdf`, AY2022–2023 checklist, pages 1–2, supplied October 19, 2026. Used for named GE/LC courses and the older PE sequence.
- `CIV-HWR for ID#124 (1).pdf`, AY2024–2025 checklist, pages 1–2, supplied October 19, 2026. Used for the newer PE sequence. This edition substitutes LCC..01–15 for the fifteen named GE/LC rows. The owner requested use of the named list from the older file, with batch-specific PE and no term grouping.
- Owner instruction: IDs119–122 use GEFTWEL, GEDANCE, GESPORTS, GETEAMS; IDs123–128 use the newer PE sequence. The older PDF prints `GESPORT` (singular); the display identity `GESPORTS` follows the owner's explicit spelling. The newer PDF prints `PE1CRDO` and `PE2FTEX`; do not silently substitute the informal spelling PECRD1O. It gives only generic `PETHREE` and `PEDFOUR` slots, so these remain editable rather than inventing actual PE3/PE4 codes.

## Named GE/LC entries: 15 × 3 units

Page 1: GEMATMW — Mathematics in the Modern World; GERIZAL — Life and Works of Rizal; GELECSP — GE Social Science & Philosophy Elective; GELECAH — GE Arts & Humanities Elective; GEPCOMM — Purposive Communication; GEUSELF — Understanding the Self; LCFAITH — Faith Worth Living; GERPHIS — Readings in Philippine History.

Page 2: GEARTAP — Art Appreciation; GEETHIC — Ethics; GESTSOC — Science, Technology and Society; GELECST — GE Science & Technology Elective; LCASEAN — The Filipino and ASEAN; LCENWRD — Encountering the Word in the World; GEWORLD — The Contemporary World.

Three GE elective slots allow the student's actual course code/title, retaining a stable slot ID and the source's 3 units. No named elective offerings are invented.

## Other non-major entries

- LCLSONE/LCLSTWO (page 1), LCLSTRI (page 2): Lasallian Studies 1–3, `(1)` unit each.
- LASARE 1/2 (page 1), LASARE 3 (page 2): Lasallian Recollection 1–3, 0 units each.
- SAS1000/SAS2000 (page 1), SAS3000 (page 2): Student Affairs Services 1000/2000/3000, 0 units each.
- NSTP101, NSTPCW1, NSTPCW2 (page 1): General Orientation (0), National Service Training Program 1 `(3)` and 2 `(3)`.
- Four PE rows per batch, 2 units each. Older file: GEFTWEL/GEDANCE page 1, GESPORT/GETEAMS page 2. Newer file: PE1CRDO/PE2FTEX page 1, PETHREE/PEDFOUR page 2.

Total: 31 rows per known batch. Display parenthesized units as written; do not fold them into a claimed official graduation unit total. No OJT, engineering ethics, programming or engineering-management courses are reclassified as general education.

## Persistence

Optional `nonMajorRecords` in the existing private progress JSON, keyed by stable course/slot identity. Each record has nullable `year` and `term`, boolean `taken`, and optional bounded editable `code`/`title`. Existing saves without the field stay unchanged. Only known IDs and valid values survive hydration; malformed checklist fields do not discard academic records.

Signed-in students use their account's self-reported `batch_id`. Guests choose a checklist-only `nonMajorBatchId` saved with their browser journey. Missing batch leaves four PE rows hidden with a prompt; the total remains 31. Changing batch never deletes older PE records, and only the applicable sequence contributes to the checklist counter. This batch handling affects this checklist only, never academic permissions or curriculum rules.

Account saving, offline cache and revision-conflict resolution use the existing progress service. Admin edits go to the isolated admin device workspace. No SQL migration, storage bucket or new secret is required. Editing a row redraws this list, not the sky.
