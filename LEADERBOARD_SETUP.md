# Batch leaderboard and account deletion

## Enable the leaderboard

1. Open the Supabase project used by Road to CELE, then **SQL Editor → New query**.
2. Paste the entire contents of `supabase/migrations/202610190004_batch_leaderboard.sql` and click **Run**. It is safe to run again. Keep the existing student-progress RLS policies.
3. Run `supabase/migrations/202610190005_display_names.sql` in a new SQL query. Existing installations that already ran the batch leaderboard migration need only this newer migration. It is safe to run again. It adds the display-name-aware RPC and updates the old RPC to use the same privacy rules.
4. Sign in to Road to CELE, select your Batch ID in **Account**, and open **Leaderboard → Refresh**. No new Cloudflare variable, service key or redeploy is needed for these SQL-only steps once the updated site is live.

The site shows a setup message until this RPC exists. It never fabricates classmates or accesses other students' private JSON directly.

## Identity settings

**Account → Display name & privacy** includes an optional display name (up to 60 Unicode characters). Save it to replace the account header name. It does not change Google identity, the sign-in username, permissions, batch or academic records. Empty names clear the custom value and restore the existing username or Google name. Email addresses and control characters are rejected.

Name sharing defaults to unchecked. Check **Show my display name to other students on my batch leaderboard**, then save to opt in; uncheck and save to return to anonymous entries. A custom name takes priority over both the Google full name and sign-in username. Without one, username accounts publish their username and Google accounts use their supplied name. Email addresses are never used as public names. Photos, individual grades, student IDs and private progress records are never returned by the leaderboard RPC. Invalid custom metadata produces an anonymous name rather than falling back to the real name.

The frontend uses `get_batch_leaderboard_v2`; it shows a setup message until the display-name migration is installed and never falls back to an older response containing a full name. Sharing a custom name checks for that RPC before saving consent. A private display name can still be saved with sharing off. After migration, older frontend clients calling `get_batch_leaderboard` also receive the chosen display name through its compatibility wrapper.

Consent is the strict boolean `raw_user_meta_data.leaderboard_show_identity`; the optional name is `raw_user_meta_data.display_name`. The RPC reads current Auth data rather than trusting a stale JWT or hiding a returned name in the browser. It returns display names only after consent; opt-out takes effect on the next read. This metadata grants no administrator permissions. A testing reset retains the account's privacy choice; deleting the account removes its leaderboard membership.

## Ranking and anonymous numbers

The owner chose percentage of required major courses completed. The RPC uses the exact ratio for ranking and rounds only the displayed percentage. It counts the known shared catalog plus the confirmed specialization, ignores unknown and unselected-branch IDs, and gives equal percentages the same rank. An undecided path uses the shared scope. The catalog snapshot in the SQL must be updated if curriculum identities or required membership change. Admin experiments are never uploaded to student progress and cannot affect these results.

Each viewer gets a fresh random UUID seed when opening or refreshing the board. The server uses it to permute unique anonymous numbers across all members of that batch. Page changes retain that seed. Thus `Anon 122 #0001` is an anonymous label, not a rank, alphabetical position or signup number. No account UUID is returned. Rows paginate in groups of 50; the requesting student's own rank is included separately. Results remain in memory only and are discarded on account, batch, consent or view changes.

The RPC derives the viewer's batch from the authenticated account and accepts no target batch/user parameter. Anonymous clients cannot call it; existing `student_progress` reads remain owner-only. Batch and academic records are self-reported app data, not university-verified standing. Only a Supabase migration is needed; no new table or storage bucket is created.

## Enable Delete account

The Pages Function uses the existing encrypted Production secret `SUPABASE_RECOVERY_SECRET_KEY`, if already configured for recovery. Alternatively set an encrypted Production secret named `SUPABASE_ADMIN_SECRET_KEY` to a Supabase server secret/service-role key, then redeploy. Keep this key out of chat, Git and all `PUBLIC_` variables. Never use a browser publishable key for this setting.

**Account → Delete account** checks server availability before showing an enabled confirmation button. Users must type `DELETE MY ACCOUNT`, check the permanent-deletion acknowledgment and submit. Opening, canceling or merely typing in the form deletes nothing. The server requires same-origin JSON and a bearer session verified through Supabase Auth, ignores client-controlled identity, and permanently deletes only that verified user through the Auth admin API. There is no endpoint for deleting an arbitrary account.

Existing foreign keys cascade deletion to private progress and recovery codes; leaderboard membership is derived from Auth and therefore disappears. The browser invalidates its active account save queue, signs out and removes only that owner's account cache, conflict/reset backups and device admin workspace. Separate guest progress and other accounts remain. Exported backups, old copies on other devices and previously viewed information cannot be remotely erased by this action.

Test deletion using a disposable test account. The feature's tests use mocked Auth requests and a local PostgreSQL engine; they do not delete the owner's live account.
