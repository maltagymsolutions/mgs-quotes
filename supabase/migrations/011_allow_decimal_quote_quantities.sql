alter table public.quote_items
  alter column qty type numeric(12, 2)
  using qty::numeric(12, 2);

notify pgrst, 'reload schema';
