# Enable username account recovery

The website changes work immediately. Recovery requires the following server setup, once. Keep Google sign-in enabled and keep the existing public configuration unchanged.

1. Open the Road to CELE project in **Supabase → SQL Editor → New query**. Paste the complete contents of [202610120003_recovery_codes.sql](supabase/migrations/202610120003_recovery_codes.sql) and run it. It is safe to rerun. This adds private recovery tables and server-only functions; it never changes course records or account passwords.
2. In **Supabase → Project Settings → API Keys**, create or copy a **secret key** (`sb_secret_…`); a legacy **service_role** key also works. This is different from the publishable browser key. Paste it directly into Cloudflare in the next step. Do not put it in chat, GitHub, or a `PUBLIC_` variable.
3. Open **Cloudflare → Workers & Pages → road-to-cele → Settings → Variables and Secrets**, select **Production**, and **Add** a variable:

   | Setting | Value |
   | --- | --- |
   | Type | Secret / encrypted |
   | Name | `SUPABASE_RECOVERY_SECRET_KEY` |
   | Value | The Supabase secret key from step 2 |

   Save the new secret. Cloudflare must expose it to the Pages Function at runtime. Do not replace the public publishable key with this value.
4. Redeploy the latest production commit. The root `functions/api/account-recovery.js` is a **Pages Function**; the site remains a Pages project. `_routes.json` sends only the recovery endpoint through the function and keeps static assets on Pages.
5. Open [recovery availability](https://road-to-cele.pages.dev/api/account-recovery). It should show `{"available":true}`. `false` means the private key or SQL migration is missing, unavailable, or belongs to another project.
6. Sign in to a test **username** account → **Account → Manage recovery codes**. Re-enter its password, generate codes, download the file and acknowledge saving it. Sign out, select **Forgot password? Use a recovery code**, and reset the test account’s password with one code. Sign in using the new password and verify the same course records remain. Reusing that code must fail. Generating another set invalidates all earlier codes.

## Behavior and verification

- Eight cryptographically random 128-bit codes per set. Codes are shown once and are never written to browser storage or progression JSON. SHA-256 hashes are stored on the server; students cannot read or mutate the recovery tables.
- Generation checks the signed-in user with Supabase Auth and reauthenticates the current password. Google-only accounts use Google's recovery flow.
- Recovery requires a normalized username and its unused code. Code consumption is atomic, preventing concurrent reuse. Only then does the server call the managed Supabase Auth Admin API to update that account's password.
- If the upstream password update fails, the code remains consumed. Use another code; the response explains this case. Existing unused codes remain valid unless replaced by a new set.
- Persistent rate limits cap attempts per IP and username in 15-minute windows. IP bucket identifiers are HMACs; plaintext IP addresses are not stored. Requests require the same origin, and all responses disable caching.
- The private API key is used only by the server. The browser bundle contains only the existing publishable key. Account recovery does not update academic progress, mastery, specialization history, or quiz attempts.
- Tests cover SQL permissions, code rotation and single-use claims, account binding, rate limits, malformed requests, server errors, password visibility, and the recovery UI. Live recovery must be checked after the private setup above; mocked tests cannot verify your dashboard configuration.
- Ordinary `npm start` serves the static UI without private recovery. For local server testing, use Cloudflare's `wrangler pages dev dist` with the secret in ignored `.dev.vars`. Never commit that file.

Primary references: [Supabase server-only account updates](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Cloudflare Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets).
