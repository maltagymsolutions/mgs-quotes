alter table public.inventory_items
  add column if not exists package_contents text[] not null default '{}'::text[];

alter table public.quote_items
  add column if not exists package_contents text[] not null default '{}'::text[];

alter table public.invoice_items
  add column if not exists package_contents text[] not null default '{}'::text[];

comment on column public.inventory_items.package_contents is
  'Display-only list of items included in an inventory package.';

comment on column public.quote_items.package_contents is
  'Snapshot of package contents shown on the quote.';

comment on column public.invoice_items.package_contents is
  'Snapshot of package contents shown on the invoice.';
