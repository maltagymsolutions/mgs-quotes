-- VAT settlement periods are independent of the date money left the account.
-- Legacy payments remain unassigned until explicitly reviewed.
begin;
alter table public.expenses
  add column if not exists vat_period_start date,
  add column if not exists vat_period_end date;

alter table public.expenses drop constraint if exists expenses_vat_period_check;
alter table public.expenses add constraint expenses_vat_period_check check (
  (vat_period_start is null and vat_period_end is null)
  or (category = 'VAT' and vat_period_start is not null and vat_period_end is not null
      and vat_period_start <= vat_period_end)
);

comment on column public.expenses.vat_period_start is 'First day of the VAT period settled; independent of expense_date.';
comment on column public.expenses.vat_period_end is 'Last day of the VAT period settled (inclusive).';

notify pgrst, 'reload schema';
commit;
