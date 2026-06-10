alter table public.invoices
  add column if not exists payment_terms text,
  add column if not exists bank_details text;

notify pgrst, 'reload schema';
