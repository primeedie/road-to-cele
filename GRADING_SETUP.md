# Syllabus-based grade calculators

Lecture courses use five tabs: I Description, II Topics, III Future skills, IV Grade calculator, V Mastery quiz. Laboratories use the first four tabs and their own grading scheme; no mastery quiz tab.

The fourth tab currently shows an explicit placeholder. Add schemes only after the owner supplies the syllabus. `src/grade-calculator.mjs` provides weighted-percentage forecasts, recorded-assessment standing, and the required raw score on a selected assessment (including an exam out of 50). It never records academic completion or mastery.

For every course, verify the syllabus version, batch/term applicability, component weights, individual assessment maxima, passing threshold, rounding increments and any minimum exam requirements, transmutation, attendance requirements or other passing conditions. Keep the file/page citation in `source`. Different labs may use different reports, practical work, projects or other components; do not copy lecture weights into labs.

`COURSE_GRADING_SCHEMES` is intentionally empty. The current calculation supports a direct weighted percentage. Each configured component must represent a verified portion of the final grade with a known maximum. Aggregate multiple assessments only using the syllabus's actual rule: pooled points and equally weighted percentages are not interchangeable. Schemes with transmutation or extra passing conditions are rejected until those rules are implemented and tested.

A required-score forecast needs all other components' scores. Blank scores remain unknown instead of silently becoming zero. When the passing target is unreachable even with full marks, say so. For unfinished courses, label the recorded-assessment average as provisional rather than declaring the official final grade.
