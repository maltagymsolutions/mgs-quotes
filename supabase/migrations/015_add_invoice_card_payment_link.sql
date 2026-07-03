alter table public.invoices
  add column if not exists card_payment_link text;

notify pgrst, 'reload schema';
