-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- before deploying. It creates the single table the app uses to store the
-- shared knowledge base as a simple key/value row.

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security is left off by design: the app talks to Supabase only
-- from the server, using the service_role key, which bypasses RLS anyway.
-- If you later add a client-side Supabase call using the public anon key,
-- turn RLS on and add a policy first.
