# Supabase

These files mirror what is deployed on the `voice-budget` Supabase project, so the setup is in version control.

- `migrations/20261117235057_init_voice_budget_schema.sql`: tables, triggers and Row Level Security policies
- `functions/delete-account/index.ts`: deletes the signed-in user (data is removed by `ON DELETE CASCADE`)

Auth settings (dashboard):
- Google provider on, with the "Voice Budget Web" OAuth client from Google Cloud project `voice-budget-515023`
- Site URL `https://okiejoedev.github.io/voice-budget-app/`
- Redirect URLs `https://okiejoedev.github.io/voice-budget-app/**` and `http://localhost:5173/**`
