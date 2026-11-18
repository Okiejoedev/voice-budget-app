-- Voice Budget: per-user settings, budget pots and transactions.
-- Every row belongs to one user; Row Level Security makes sure users only touch their own rows.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  onboarded boolean not null default false,
  last_period_start date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pots (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🧾',
  planned bigint not null default 0 check (planned >= 0),
  carry bigint not null default 0 check (carry >= 0),
  keywords text[] not null default '{}',
  sort integer not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  type text not null check (type in ('expense', 'income', 'vault_in', 'vault_out')),
  amount bigint not null check (amount > 0 and amount < 10000000000),
  pot_id text,
  note text not null default '' check (char_length(note) <= 200),
  said text check (char_length(said) <= 500),
  date date not null,
  source text not null default 'typed' check (source in ('voice', 'typed', 'manual', 'system')),
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index pots_user_updated_idx on public.pots (user_id, updated_at);
create index transactions_user_updated_idx on public.transactions (user_id, updated_at);
create index transactions_user_date_idx on public.transactions (user_id, date);

-- updated_at is always set by the server, so devices can ask "what changed since X?"
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger pots_set_updated_at before insert or update on public.pots
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before insert or update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.pots enable row level security;
alter table public.transactions enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles: delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "pots: read own" on public.pots for select to authenticated using ((select auth.uid()) = user_id);
create policy "pots: insert own" on public.pots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "pots: update own" on public.pots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pots: delete own" on public.pots for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions: read own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions: insert own" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions: update own" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions: delete own" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.pots, public.transactions from anon;
grant select, insert, update, delete on public.profiles, public.pots, public.transactions to authenticated;
