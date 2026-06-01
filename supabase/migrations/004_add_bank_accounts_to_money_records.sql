alter table public.expenses
  add column if not exists bank_account text not null default 'Luke';

alter table public.expenses
  drop constraint if exists expenses_bank_account_check;

alter table public.expenses
  add constraint expenses_bank_account_check
  check (bank_account in ('Luke', 'Karl', 'Robert', 'Split'));

alter table public.payment_receipts
  add column if not exists bank_account text not null default 'Luke';

alter table public.payment_receipts
  drop constraint if exists payment_receipts_bank_account_check;

alter table public.payment_receipts
  add constraint payment_receipts_bank_account_check
  check (bank_account in ('Luke', 'Karl', 'Robert', 'Split'));
