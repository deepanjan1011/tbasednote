# Supabase Setup

Cloud sync and auth are optional. The app still works fully in local-only mode without this setup.

## 1. Create a Supabase project

Create a new project in Supabase and keep these values:

- `Project URL`
- `anon public key`

## 2. Add env vars

Create or update `.env` in the project root:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

`VITE_GEMINI_API_KEY` is only required for AI completion and semantic search.

## 3. Create the `notes` table

Use a table with these columns:

```sql
create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted boolean default false
);
```

## 4. Enable Row Level Security

```sql
alter table public.notes enable row level security;
```

## 5. Add policies

```sql
create policy "Users can read own notes"
on public.notes
for select
using (auth.uid() = user_id);

create policy "Users can insert own notes"
on public.notes
for insert
with check (auth.uid() = user_id);

create policy "Users can update own notes"
on public.notes
for update
using (auth.uid() = user_id);

create policy "Users can delete own notes"
on public.notes
for delete
using (auth.uid() = user_id);
```

## 6. Enable auth providers

In Supabase Auth:

- enable Email auth if you want email/password sign-in
- enable Google provider if you want Google login

For Google OAuth, also add your local dev URL and deployed URL to the allowed redirect URLs.
