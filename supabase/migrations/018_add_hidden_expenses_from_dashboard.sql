alter table public.expenses
  add column if not exists hidden_from_dashboard boolean not null default false;

create index if not exists expenses_hidden_from_dashboard_idx
  on public.expenses(hidden_from_dashboard);
