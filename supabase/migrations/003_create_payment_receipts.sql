create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  receipt_type text not null check (receipt_type in ('deposit', 'balance')),
  receipt_date date not null default current_date,
  amount_paid numeric(12, 2) not null check (amount_paid >= 0),
  notes text,
  unique (invoice_id, receipt_type)
);

create index if not exists payment_receipts_invoice_id_idx
  on public.payment_receipts(invoice_id);

alter table public.payment_receipts enable row level security;

drop policy if exists "Authenticated users can manage payment receipts" on public.payment_receipts;

create policy "Authenticated users can manage payment receipts"
  on public.payment_receipts
  for all
  to authenticated
  using (true)
  with check (true);
