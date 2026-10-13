# Road to CELE: notes for explaining the code

## A short explanation

“Road to CELE is a curriculum tracker presented as a constellation map. It uses HTML, CSS and JavaScript modules, with Supabase for accounts and saved progress, and Cloudflare Pages for hosting. The skeleton contains the course graph, prerequisite rules, progress records, map interactions and spaces for course content. The syllabus summaries and actual assessments are added separately after reviewing the course files.”

## What “skeleton” means here

It is the working foundation that content plugs into:

| Part | What it does | Main file |
| --- | --- | --- |
| Curriculum data | Defines course IDs, titles, terms, units, branches and prerequisites | `src/curriculum.mjs` |
| Progression rules | Decides whether a course can activate and updates academic/mastery records | `src/progression.mjs` |
| Interface | Connects buttons, course panels, map browsing and saving | `src/app.js` |
| Course content slots | Description, compact topics, future skills and mastery quiz | `src/course-panel.mjs` |
| Guest saving | Loads and validates the browser's saved journey | `src/storage.mjs` |
| Account saving | Separates account journeys, handles cloud saving and conflicts | `src/account-progress.mjs` |

The curriculum is one graph: courses are nodes, and prerequisites are links. Shared courses have one identity across all five specializations. Revealing a branch changes what is displayed; it does not duplicate shared courses or create another account journey.

The data came from the supplied DLSU ID122 checklists. Its scope is technical courses: 67 shared courses and 21 specialization courses across the five branches. The displayed technical denominator excludes GE, PE, NSTP and OJT.

## How a course works

A course record has this shape; the source creates these objects from compact rows:

```js
{
  id: 'CALENG1',
  title: 'Differential Calculus',
  year: 1,
  term: 2,
  units: 3,
  specialization: null,
  hardPrerequisites: ['FNDMATH'],
  softPrerequisites: [],
  corequisites: [],
  courseKind: 'LECTURE',
  requiredMastery: true
}
```

The course code is the stable key. The title can change without losing that course's progress. The internal `term` counts across the whole curriculum; year and within-year term labels can be derived from it.

When a user activates a course, the app asks the rule engine whether it is allowed. The engine returns a new progress object, the account layer saves it, and the interface renders the result. Rules are centralized so the map and course panel use the same answer.

- **Hard prerequisite (H):** academically completed first.
- **Soft prerequisite (S):** activated or academically completed first.
- **Lecture co-requisites:** eligible connected lecture partners activate together.
- **Laboratory co-requisites:** the lecture must already be active/completed in the same or an earlier recorded term. A lab cannot come first.
- **Preview:** browsing another branch does not record progress.

Academic completion is self-reported. It is stored separately from app mastery. CIVINCO eligibility uses the confirmed academic path and required mastery; passing its integration assessment unlocks the common CELE Hardmode. Assessment boundaries exist, but the actual quizzes and CIVINCO content still await files.

## How the constellation interface works

The constellation outlines use attributed catalog geometry. Courses are assigned to their vertices. SVG draws the lines and raised stars; perspective projection, facets and bases create the sense of depth.

The map has world coordinates. Panning and zooming transform the world container, while the course identities and records stay the same. Pan limits use the populated map regions. Zoom uses `requestAnimationFrame` and elapsed-time easing; pointer anchoring keeps the location under the cursor steady.

Rotation updates the outlines, nodes and prerequisite hit areas together through a bounded 45-degree loop. It pauses for interaction and reduced motion. The black hole uses small local SVG layers, curved trails and inward particles.

For overview readability, line width increases as camera scale decreases: roughly `world stroke width = desired screen width / zoom scale`. Active/completed stars also gain a modest overview size boost. Completion is brightest, activation is intermediate, and unactivated stars stay faint. Activation illuminates only nearby line segments, fading out at their midpoint.

## Accounts, deployment and checking changes

Supabase Auth manages Google sign-in and passwords. Username accounts use an internal email-shaped identifier because of Supabase's email/password interface; students enter a username. Guest progress stays in local storage. Signed-in progress is stored in private database rows protected by row-level security, with revision checks for conflicting device saves.

Recovery codes use a Cloudflare Pages Function and private database operations; deployment setup is documented in `RECOVERY_SETUP.md`. Availability depends on that private setup. Public browser configuration and server secrets have different roles.

`npm run build` uses Node to prepare `dist/`, combine/minify CSS, bundle the Supabase client, and write the asset provenance manifest. Cloudflare builds from GitHub and serves the result. Node is used for the build; the map runs in the browser.

Automated tests cover prerequisites, lab ordering, read-only previews, transfers, account isolation, database permissions, gestures, recovery and gate separation. Visual appearance and device performance still need browser/device checks.

## Good follow-up answers

**Why separate data from rules and visuals?** A curriculum change can be made in the data without rebuilding the map logic. The same prerequisite checks serve every screen, and visuals cannot silently redefine progress.

**What is finished versus planned?** The graph, progression, account flow and interactive map work. Course descriptions, topic summaries, verified future skills and actual assessments are content work pending files. Mini-games are ideas, not implemented course assessments.

**What was the difficult part?** Keeping rotating visual anchors and clickable paths aligned, making pan/zoom smooth, handling directional lab requirements, and preventing previews or account switches from changing the wrong journey.

**If someone asks about AI assistance:** Describe the workflow accurately: the project's requirements, visual direction and course materials were developed through an iterative process with coding assistance, followed by code changes, automated checks and deployment. These notes explain the implementation; they are not a claim that every line was manually typed.
