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


-- A pool of unique, single-use coupon codes per site. A code is either
-- available or claimed, once claimed it can never be handed out again.
create table if not exists coupon_pool (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  code text not null,
  status text not null default 'available' check (status in ('available', 'claimed')),
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, code)
);

create index if not exists coupon_pool_site_status_idx on coupon_pool (site_id, status);

-- Atomically hands out one available code for a site and marks it claimed,
-- so two agents clicking "claim a code" at the same moment can never walk
-- away with the same code. FOR UPDATE SKIP LOCKED means a concurrent call
-- skips a row another call is already in the middle of claiming, instead of
-- waiting for it or double-claiming it.
create or replace function claim_coupon(p_site_id text, p_claimed_by text default null)
returns table(code text) as $$
declare
  v_id uuid;
  v_code text;
begin
  select id, coupon_pool.code into v_id, v_code
  from coupon_pool
  where site_id = p_site_id and status = 'available'
  order by created_at asc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  update coupon_pool
  set status = 'claimed', claimed_by = p_claimed_by, claimed_at = now()
  where id = v_id;

  code := v_code;
  return next;
end;
$$ language plpgsql;


-- Holds knowledge submissions that need a human decision before becoming
-- part of the live knowledge base, either because they conflict with
-- something already recorded, or because the ingestion step couldn't
-- confidently tell which site (or common) they belong to.
create table if not exists kb_review_queue (
  id uuid primary key default gen_random_uuid(),
  target text not null, -- 'common' or a site id, best guess if unclear
  proposed_fact text not null,
  raw_input text not null, -- exactly what was submitted, for context
  reason text not null, -- why this needs review, in plain language
  conflicting_with text, -- the existing fact it conflicts with, if any
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists kb_review_queue_status_idx on kb_review_queue (status);

