create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expense_date date not null default current_date,
  supplier text,
  description text not null,
  category text not null check (
    category in ('Equipment', 'Transport', 'Professional fees', 'Tax', 'Shipping')
  ),
  vat_rate numeric(5, 2) not null check (vat_rate in (0, 5, 7, 18)),
  amount_incl_vat numeric(12, 2) not null check (amount_incl_vat >= 0)
);

alter table public.expenses enable row level security;

drop policy if exists "Authenticated users can manage expenses" on public.expenses;

create policy "Authenticated users can manage expenses"
  on public.expenses
  for all
  to authenticated
  using (true)
  with check (true);
