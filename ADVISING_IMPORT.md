# Academic advising booklet import

Open **My journal → Import booklet PDF**. Choose a text-based PDF (up to 10 MB and 80 pages), review the detected subjects, set the current journey term and academic path, then explicitly confirm and apply. The import interface uses Years 1–6. Scanned/handwritten PDFs, password-protected copies and unrelated table layouts require a readable export or manual entry.

## Reading and privacy

Mozilla PDF.js is pinned in package.json, copied with its license and standard fonts into `dist/vendor`, and loaded only after file selection. Its worker is hosted with the site; there is no CDN or remote PDF-reading service. See [PDF.js examples](https://mozilla.github.io/pdf.js/examples/index.html) and [API reference](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).

Only tables with Course Code / Units / Grade headers and a recognized journey-term heading are parsed. Columns are matched by text positions, preserving blank grades. The advising template's First Term, Fourth Term, etc. refer to sequential journey terms; local Year/Term is calculated from three terms per year. Cover sheets, contacts, guardian details, GPA summaries, signatures and adviser notes are ignored. File bytes, filenames and student identifiers are not persisted. Only confirmed course records enter the existing private account progress JSON. The PDF remains on the student's device.

The owner supplied a private 24-page advising booklet for local verification on October 19, 2026; relevant course tables are on pages 3–14. The document and extracted data are excluded from Git and the deployed assets. Automated tests use a generated synthetic PDF without the owner's personal records.

## Review and merging

- 1.0–4.0 in half-grade increments and P mean passed; 0.0 and F mean failed. Other grade marks require review and are not silently interpreted as passes.
- Blank grades are excluded. A listed ungraded major course can be explicitly marked Currently active; this never overrides an existing passing course or a later saved grade.
- LBBCH1A maps to LBYCH1A (Chemistry for Engineers Laboratory); GESPORT maps to the checklist's GESPORTS identity. Normalized LASARE spacing does not change its identity. These variants are supported by owner-supplied curriculum documents. No fuzzy code matching is used.
- Unknown GE/LC-style codes remain additional non-major records. Students may explicitly map them to the appropriate elective slot. Do not infer an elective category from an unsupported abbreviation or silently fill unrelated requirements.
- Owner-approved elective equivalents: GELITPH → GELECAH, LCFILIA → GELECSP, LCFILIB → GELECST. These match automatically. Reimporting a previously unmatched record upgrades its elective match while retaining the earlier snapshot; conflicting existing slot dates or course names still require review.
- PE matches respect the existing batch-specific checklist. Unit mismatches and two rows mapping to the same subject in the same term require review.
- Matching saved course/term grades are idempotent. Conflicting grades and checklist dates are kept by default; replacement requires an explicit Use booklet choice. Replaced grade snapshots, including previous calculator assessment breakdowns, remain in revisions. Historical failing attempts never disappear after a passing retake.
- Current term and specialization are reviewed alongside the import. Path changes use the ordinary self-reported confirmation/transfer functions, with transfer history retained. Import does not grant an administrator role or university-verified standing.
- Account, batch and Student/Admin view changes cancel pending work and previews. Changes to the active progress snapshot require reviewing a refreshed preview before applying. Academic imports are written atomically in the existing account save flow, including revision conflicts and offline caching. Admin imports remain in the separate device workspace.

## Final grades and progression

Imported major results use `academicRecords[id].gradeAttempts` with `method: BOOKLET_IMPORT`, a final `grade` (nullable only for P), `gradeText`, `outcome`, `term`, `confirmedAt`, and `revisions`. `total` and `draft` are explicitly null: a final point grade cannot be reversed into raw percentages, quiz scores, or syllabus eligibility checks. The grade panel displays the imported final grade rather than a fabricated calculator breakdown. Corrections use another reviewed import. Later retakes may use the existing calculator and a fresh assessment draft.

Passing attempts complete their nodes. Failures satisfy activation-based soft requirements and block hard requirements until a passing prior-term attempt exists. Import records historical results directly rather than forcing a student to reenact every activation, but ordinary access rules still govern new enrollments. Imported results do not grant mastery, quiz results, integration-assessment passes or CIVINCO clearance. Previously supplied standing, cosmetics, profile photos, quiz attempts and unrelated academic records are preserved.

Non-major final-grade history is kept in bounded `advisingNonMajor` records. Mapped courses update the existing `nonMajorRecords` date and Taken checkbox; unmapped non-major records appear in the summary without checking an unrelated slot. Taken records a course attempt and does not itself certify a passing grade.

## Summary and deployment

My journal shows separate Major courses and Non-major courses tables. Major attempts are ordered by actual journey term, including repeats, final grades and explicitly active attempts. Manual records without known grades show a dash. Non-major entries are listed separately with their dates and known grades. The summary is derived from existing records, not a second editable copy.

No SQL migration, storage bucket, additional secret, SMTP service or paid parsing API is required. Build with `npm run build`; the worker and library versions must match. The main map does not load PDF.js until a booklet is chosen.
