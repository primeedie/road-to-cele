# Owner account and views

The requested username account is freshmilchh, batch ID 122. Its confirmed Supabase user ID is 747ef767-6a10-4eac-9c93-f3af9e03d737. Passwords are managed by Supabase and are never shipped in the website code.

Sign in normally. The sidebar shows Student view / Admin view buttons after the server verifies your Supabase identity. The server binds the owner role to that exact immutable user ID and reserved username identifier. It also recognizes a trusted app_metadata.road_to_cele_admin flag for administrators explicitly assigned through Supabase. Editable profile metadata, a username alone, local settings and batch IDs cannot grant access.

Student view uses normal academic rules and cloud saving. Admin view opens all course tabs, permits any course activation/completion without prerequisites, and opens cosmetic frames. Features awaiting teaching/quiz files remain placeholders.

Admin experiments use a separate device-only workspace bound to the verified account. Admin reset clears only that workspace and retains the student cloud journey. During testing, `src/testing-mode.mjs` enables a separate confirmed student/guest reset. Student reset clears that account’s academic history, checklist, specialization, mastery and earned frames, retaining the profile photo, batch and companion avatar. It writes an account-scoped `.testing-reset-backup` on the device before replacing the active journey, then uses normal revision-checked cloud saving. Guest reset is browser-only. Failed backup/cache writes leave the active journey unchanged. Reset confirmation is bound to the account and view that opened it. Set `STUDENT_TESTING_RESET_ENABLED` to false to hide student/guest reset again. Switching accounts cancels pending role checks and returns to Student view.

The /api/admin-access Pages Function validates the bearer token with Supabase Auth on the server. It is read-only and needs the existing public project configuration; the owner account does not require an additional secret or SQL setup. If the identity cannot be verified, the application keeps Student view available.

Supabase account metadata reference: https://supabase.com/docs/guides/auth/users
