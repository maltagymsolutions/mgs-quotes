create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  transfer_date date not null default current_date,
  from_account text not null,
  to_account text not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  check (from_account in ('APS', 'Luke', 'Karl', 'Robert')),
  check (to_account in ('APS', 'Luke', 'Karl', 'Robert')),
  check (from_account <> to_account),
  check (
    (from_account = 'APS' and to_account in ('Luke', 'Karl', 'Robert'))
    or (to_account = 'APS' and from_account in ('Luke', 'Karl', 'Robert'))
  )
);

create index if not exists account_transfers_transfer_date_idx
  on public.account_transfers(transfer_date);

alter table public.account_transfers enable row level security;

drop policy if exists "Authenticated users can manage account transfers" on public.account_transfers;

create policy "Authenticated users can manage account transfers"
  on public.account_transfers
  for all
  to authenticated
  using (true)
  with check (true);
