alter table public.quote_items
  add column if not exists item_discount_percent numeric(5, 2) not null default 0;

alter table public.quote_items
  drop constraint if exists quote_items_item_discount_percent_check;

alter table public.quote_items
  add constraint quote_items_item_discount_percent_check
  check (item_discount_percent >= 0 and item_discount_percent <= 100);

alter table public.invoice_items
  add column if not exists item_discount_percent numeric(5, 2) not null default 0;

alter table public.invoice_items
  drop constraint if exists invoice_items_item_discount_percent_check;

alter table public.invoice_items
  add constraint invoice_items_item_discount_percent_check
  check (item_discount_percent >= 0 and item_discount_percent <= 100);

notify pgrst, 'reload schema';
