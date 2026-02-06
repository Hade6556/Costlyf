# Supabase setup

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your project → **SQL Editor**.
2. Run the migration script `migrations/001_profiles.sql` to create the `profiles` table and RLS policies.
3. Ensure `.env` has:
   - `SUPABASE_URL` – your project URL (e.g. `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` – for login
   - `SUPABASE_SERVICE_ROLE` or `SUPABASE_SECRET_KEY` – for signup and API (keep secret)

Accounts use **Supabase Auth** (email + password) and **profiles** (Phone, E-mail, Date of Birth, Alias, First name, Last name). Password is stored only in Auth; profile fields are in `public.profiles`.

**Profile pictures (Vercel):** Create a Storage bucket named `avatars` and set it to **Public** (Storage → New bucket → name `avatars` → Public bucket). The app uploads avatars there on Vercel so they persist; locally it uses `/uploads/avatars/`.
