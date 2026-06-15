create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  reference text,
  shipment_date date,
  status text not null default 'Planning' check (
    status in ('Planning', 'Ordered', 'In transit', 'Received', 'Closed')
  ),
  notes text
);

alter table public.shipments enable row level security;

drop policy if exists "Authenticated users can manage shipments" on public.shipments;

create policy "Authenticated users can manage shipments"
  on public.shipments
  for all
  to authenticated
  using (true)
  with check (true);

alter table public.invoices
  add column if not exists shipment_id uuid references public.shipments(id) on delete set null;

alter table public.expenses
  add column if not exists shipment_id uuid references public.shipments(id) on delete set null;

create index if not exists invoices_shipment_id_idx
  on public.invoices(shipment_id);

create index if not exists expenses_shipment_id_idx
  on public.expenses(shipment_id);

notify pgrst, 'reload schema';
