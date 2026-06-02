alter table public.expenses
  add column if not exists paid_by_owner text,
  add column if not exists split_owners text[];

update public.expenses
set paid_by_owner = case
  when bank_account in ('Luke', 'Karl', 'Robert') then bank_account
  else 'Luke'
end
where paid_by_owner is null;

update public.expenses
set split_owners = array[paid_by_owner]
where split_owners is null or cardinality(split_owners) = 0;

alter table public.expenses
  alter column paid_by_owner set not null,
  alter column paid_by_owner set default 'Luke';

alter table public.expenses
  alter column split_owners set not null,
  alter column split_owners set default array['Luke'];

alter table public.expenses
  drop constraint if exists expenses_paid_by_owner_check;

alter table public.expenses
  add constraint expenses_paid_by_owner_check
  check (paid_by_owner in ('Luke', 'Karl', 'Robert'));

alter table public.expenses
  drop constraint if exists expenses_split_owners_check;

alter table public.expenses
  add constraint expenses_split_owners_check
  check (
    cardinality(split_owners) > 0
    and split_owners <@ array['Luke', 'Karl', 'Robert']::text[]
  );

alter table public.payment_receipts
  add column if not exists received_by_owner text;

update public.payment_receipts
set received_by_owner = case
  when bank_account in ('Luke', 'Karl', 'Robert') then bank_account
  else 'Luke'
end
where received_by_owner is null;

alter table public.payment_receipts
  alter column received_by_owner set not null,
  alter column received_by_owner set default 'Luke';

alter table public.payment_receipts
  drop constraint if exists payment_receipts_received_by_owner_check;

alter table public.payment_receipts
  add constraint payment_receipts_received_by_owner_check
  check (received_by_owner in ('Luke', 'Karl', 'Robert'));
