# Cloudflare Pages + Supabase

The website uses Cloudflare Pages and Supabase for Google sign-in and private account progress. The owner's public project URL and publishable key are configured in `config/public-production.json`. Cloudflare production builds from `main` include these browser settings without requiring dashboard variables. Explicit environment settings override them. No privileged credentials are stored in this file.

## 1. Supabase

Create a **Free** organization/project named `road-to-cele` at https://supabase.com/dashboard. Choose an available region near your users (Singapore if available). Keep the database password private; it does not go into the website.

Run `supabase/migrations/202610110001_student_progress.sql` in the project's SQL Editor, or have the connected Supabase integration apply it. It creates the private `student_progress` table and revision-checked save function. Row-level security permits authenticated students to read only their own row. Browser clients cannot directly insert, update, or delete rows. The save function verifies the signed-in user matches the intended account before writing. Records are app self-reports, not university-verified results.

Under Project Settings / API Keys, copy the **project URL** and **publishable key**. A legacy `anon` key also works. Never use a secret key, `service_role`, database password, or Supabase management token in website configuration. The build rejects privileged keys.

## 2. Cloudflare Pages

Create your account at https://dash.cloudflare.com/sign-up. In **Workers & Pages**, create a **Pages** project with Git integration. Connect only `primeedie/road-to-cele` when selecting repository access.

| Setting | Value |
| --- | --- |
| Project name | `road-to-cele` (or another available name) |
| Repository | `primeedie/road-to-cele` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Leave blank |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `NODE_VERSION` = `24` |
| Environment variable | `PUBLIC_SUPABASE_URL` = your project URL |
| Environment variable | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key |

Cloudflare installs dependencies from the lockfile before running the build. Save and deploy. Use the actual `*.pages.dev` URL returned by Cloudflare; the requested name may already be taken. These two Supabase values are intentionally public browser configuration. Privileged credentials are unnecessary for hosting the app.

Production automatically redeploys from `main` and uses `config/public-production.json` when neither Supabase environment variable is supplied. Keep production Supabase variables out of preview builds unless you deliberately want previews to use the same database. Preview and local builds without explicit variables safely run guest-only mode. Change the public configuration file when moving production to another Supabase project; clear both values to disable production login. A partial environment override fails the build instead of mixing settings from different projects.

## 3. Google sign-in

In Supabase **Authentication > URL Configuration**, set **Site URL** to the exact Cloudflare production URL, including a trailing `/`. Add that same URL and `http://localhost:4173/` to the allowed redirect URLs. Do not allow wildcard production redirects.

In Google Cloud, create/configure an OAuth project for **Road to CELE** and a **Web application** OAuth client. Request only `openid`, email, and profile access. Add the actual production origin and `http://localhost:4173` under Authorized JavaScript origins. Add the Supabase callback URL shown in its Google provider settings under Authorized redirect URIs (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).

In Supabase **Authentication > Sign In / Providers > Google**, enable the provider and enter the Google client ID and client secret there. The Google secret stays in Supabase; do not commit it. If Google's OAuth app is in Testing, add your own email and tester emails to its test users. Publish the OAuth app when ready to admit other students; complete any verification Google requires.

Official references: [Cloudflare Git deployments](https://developers.cloudflare.com/pages/get-started/git-integration/), [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase public keys](https://supabase.com/docs/guides/api/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Local setup

Copy `.env.example` to `.env.local` and replace the two example values with the public project settings. `.env.local` is ignored by Git. Run `npm run build`, then `npm start`, and open http://localhost:4173. Google login must have the localhost redirect allowed.

## Username and password signup (no student email)

The account window offers Google and username/password sign-in. Username accounts use lowercase, case-insensitive identifiers (3–24 letters, numbers, or underscores); Supabase manages password hashing, sessions, rate limits, and the existing private progress rows. The internal reserved `.invalid` address is an adapter for Supabase's email-shaped identifier, not a student's mailbox. It never appears in the UI or receives mail. Google accounts continue using Google OAuth.

To enable username signup:

1. Run `supabase/migrations/202610110002_username_signup.sql` in Supabase SQL Editor.
2. In **Authentication > Hooks**, add a **Before User Created** Postgres hook targeting `public.road_to_cele_before_signup`. This allows Google and valid username identifiers and rejects real-email password signups.
3. In **Authentication > Sign In / Providers > Email**, leave Email enabled and turn **Confirm email** off. Save. The Email provider powers the internal identifier adapter; students never enter email. Configure a minimum password length of 8 in the password settings.

Apply the hook before disabling confirmation. The browser checks the public confirmation setting and refuses to submit username signup while confirmation is still enabled, avoiding mail delivery attempts. Registration requires an actual authenticated session before loading account progress. Google stays available while this setup is pending.

Username-only accounts have no email password recovery. Keep passwords safe; users can choose Google if they prefer Google's recovery options. The two login methods do not automatically merge accounts or progress. No admin/service-role credential is needed in the browser or Cloudflare build.

Official reference: [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

## Saving behavior

- Guest progress stays in the existing `cele-atlas.progress.v3` browser key.
- Each account has a separate local cache and private cloud row. Signing out restores the guest journey. Signing into another account never imports the previous account's records.
- First login with guest progress asks whether to import that guest journey or start a new account journey. Existing cloud saves take precedence; guest saves are preserved separately.
- Offline edits stay on the device. Use **Retry save** when connected. A newer cloud revision prompts a choice; it is never silently overwritten. Choosing the device copy retains a local backup of the displaced cloud snapshot.
- Reset explicitly clears the currently active journey. When signed in, it also updates that account's cloud save; it does not clear the guest or other accounts' saves. Export a backup first if needed.
- Specialization transfers retain course records, attempts, and previous-specialization history. Preview never saves progress. Quizzes remain placeholders.

Before sharing broadly, verify Google sign-in, complete a course, sign in on a second device and confirm it appears, then sign out and verify guest isolation. Confirm the Supabase project's free-plan limits and inactivity pausing policy suit your use.
