# Syllabus-based grade calculators

Lecture courses use five tabs: I Description, II Topics, III Future skills, IV Grade calculator, V Mastery quiz. Laboratories use the first four tabs and their own grading scheme; no mastery quiz tab.

The fourth tab now has 19 supplied syllabus schemes; other courses remain explicit placeholders. `src/syllabus-data.mjs` records file/version/page references, with coverage in SYLLABUS_STATUS.md. `src/grade-calculator.mjs` provides weighted-percentage forecasts, recorded-assessment standing, and the required raw score on a selected assessment (including an exam out of 50). It never records academic completion or mastery.

For every course, verify the syllabus version, batch/term applicability, component weights, individual assessment maxima, passing threshold, rounding increments and any minimum exam requirements, transmutation, attendance requirements or other passing conditions. Keep the file/page citation in `source`. Different labs may use different reports, practical work, projects or other components; do not copy lecture weights into labs.

The current calculation supports direct weighted percentages and the BASPHYS/ENGPHYS rule giving 50% to the higher exam percentage and 35% to the other. The physics required-score forecast solves the piecewise rule rather than fixing one weight in advance. Category inputs use instructor-computed percentages: pooled points and equally weighted percentages are not interchangeable. Single assessments allow a student-supplied raw maximum; the default of 100 means percentage entry, not a claim that the actual exam has 100 marks. Required-score increments are a planning choice rather than an official rounding rule.

Known attendance and submission conditions use explicit self-reported Met / Not met / Not checked states. They remain separate from numeric standing; an unmet condition can override a passing numeric grade, while unchecked conditions remain unknown. Students enter already adjusted individual scores after peer evaluation, deductions or confirmed bonuses. The calculator does not invent or apply unquantified bonus, penalty, attendance-exception or official rounding policies. Arbitrary transmutation and unsupported extra passing conditions are still rejected.

A required-score forecast needs all other components' scores. Blank scores remain unknown instead of silently becoming zero. When the passing target is unreachable even with full marks, say so. For unfinished courses, label the recorded-assessment average as provisional rather than declaring the official final grade.
