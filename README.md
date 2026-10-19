# Road to CELE

A Civil Engineering skill-tree skeleton with a static interface and an optional Cloudflare Pages recovery function with guest saving and optional Supabase accounts with a near-black galaxy UI. Courses appear as constellation stars connected by prerequisite links. One curriculum graph contains shared technical courses and all five specialization branches. Quizzes and course descriptions are intentionally deferred.

Run `npm ci`, `npm test`, `npm run build`, then `npm start`. On Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. Open http://localhost:4173.

For a presentation-friendly explanation of the skeleton and implementation, see [CODE_WALKTHROUGH.md](CODE_WALKTHROUGH.md).

The Non-major checklist records GE, Lasallian, PE, NSTP and student formation courses in one list, with Year Taken / Term dropdowns and batch-specific PE subjects. It saves with the existing account journey and has no effect on technical prerequisites. See [NON_MAJOR_CHECKLIST.md](NON_MAJOR_CHECKLIST.md) for details and supplied-file provenance.

My journal can import a text-based academic advising PDF after a review, update major and non-major records, and show subjects taken in separate summary tables. PDFs are read on the device; only confirmed course rows are saved. Retakes and previous grades are retained. See [ADVISING_IMPORT.md](ADVISING_IMPORT.md).
