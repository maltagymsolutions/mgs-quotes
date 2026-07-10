alter table public.expenses
  alter column bank_account set default 'APS';

alter table public.expenses
  drop constraint if exists expenses_bank_account_check;

alter table public.expenses
  add constraint expenses_bank_account_check
  check (bank_account in ('APS', 'Luke', 'Karl', 'Robert'));

alter table public.payment_receipts
  alter column bank_account set default 'APS';

alter table public.payment_receipts
  drop constraint if exists payment_receipts_bank_account_check;

alter table public.payment_receipts
  add constraint payment_receipts_bank_account_check
  check (bank_account in ('APS', 'Luke', 'Karl', 'Robert'));
