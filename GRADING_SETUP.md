# Syllabus-based grade calculators

Lectures use five tabs ending with Grade calculator (IV) and Mastery quiz (V). Labs use four tabs ending with their grade calculator. Students activate the course before accessing these tabs; Admin view opens every course tab without prerequisites.

There are 19 verified schemes in src/syllabus-data.mjs, including internal file/version/page references. Weights and passing thresholds are unchanged. Courses without a supplied grading scheme remain placeholders.

Students add individual earned/perfect quiz entries. At the owner's choice, each quiz percentage contributes equally to its category average; total points are not pooled. Long quizzes/exams use LQ labels, short quizzes use SQ, and knowledge checks use KCQ. Incomplete rows leave the category unknown. Rows may be removed or corrected.

Final Exam uses a single earned/perfect pair and displays its percentage automatically. Other requirements take the student's already computed average out of 100. Actual quiz and final-exam scores may exceed their perfect scores: 105/100 contributes 105%, without capping the awarded bonus. A required score above the perfect score is labelled as dependent on bonus points actually being awarded.

The calculator uses weighted percentages and the BASPHYS/ENGPHYS rule assigning 50% to the higher exam percentage and 35% to the other. Physics forecasts solve the changing-weight rule. Assessment maxima come from the student; 100 is an editable final-exam default, not a claim about the exam's maximum. Required-score increments are planning choices, not official rounding policies.

Attendance/submission conditions remain self-reported Met / Not met / Not checked requirements. Unmet conditions can override a numeric passing score. Enter instructor-adjusted scores after peer evaluations and penalties. No bonus award, official rounding rule, transmutation or attendance exception is invented.

Blank scores are unknown, not zero. Exact forecasts require other components' scores. Results are estimates and never record academic completion or mastery. Calculator drafts are separate between Student view and Admin view and are cleared on account changes.
