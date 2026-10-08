begin;

-- Keep all existing categories and add the approved travel, meal and fuel categories.
alter table public.expenses
  drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (
    category in (
      'Equipment', 'Professional fees', 'Tax', 'Shipping', 'VAT',
      'Advertising', 'Bank Charges', 'Travel', 'Meals', 'Fuel'
    )
  );

commit;
