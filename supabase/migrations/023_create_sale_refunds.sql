create table public.sale_refunds (
  id uuid primary key,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  receipt_id uuid not null references public.payment_receipts(id) on delete restrict,
  refund_date date not null,
  amount numeric(12, 2) not null check (amount > 0 and amount < 'Infinity'::numeric),
  bank_account text not null check (bank_account in ('APS', 'Luke', 'Karl', 'Robert')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500)
);

create index sale_refunds_invoice_id_idx on public.sale_refunds(invoice_id);
create index sale_refunds_receipt_id_idx on public.sale_refunds(receipt_id);

alter table public.sale_refunds enable row level security;
revoke all on public.sale_refunds from public, anon, authenticated;
grant select on public.sale_refunds to authenticated;
create policy "Authenticated users can view sale refunds"
  on public.sale_refunds for select to authenticated using (true);

create function public.record_sale_refund(
  refund_id uuid,
  payment_id uuid,
  paid_on date,
  refund_amount numeric,
  paid_from text,
  refund_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  receipt public.payment_receipts%rowtype;
  existing public.sale_refunds%rowtype;
  already_refunded numeric;
  clean_reason text := btrim(refund_reason);
begin
  if actor is null then
    raise exception 'Sign in to record a refund.';
  end if;

  -- Serialize refunds and receipt edits for this payment.
  select * into receipt from public.payment_receipts where id = payment_id for update;
  if not found then
    raise exception 'The original payment receipt was not found.';
  end if;

  -- A retry after a lost response returns the original record.
  select * into existing from public.sale_refunds where id = refund_id;
  if found then
    if existing.created_by = actor and existing.receipt_id = payment_id
      and existing.refund_date = paid_on and existing.amount = refund_amount
      and existing.bank_account = paid_from and existing.reason = clean_reason then
      return existing.id;
    end if;
    raise exception 'This refund was already saved. Refresh the invoice before recording another.'
      using errcode = '23505';
  end if;

  if paid_on is null or paid_on < receipt.receipt_date
    or paid_on > (now() at time zone 'Europe/Malta')::date then
    raise exception 'Use a refund date between the payment date and today.';
  end if;

  if refund_amount is null or not (refund_amount > 0 and refund_amount < 'Infinity'::numeric)
    or refund_amount <> round(refund_amount, 2) then
    raise exception 'Enter a positive refund amount with up to two decimal places.';
  end if;

  if paid_from is null or paid_from not in ('APS', 'Luke', 'Karl', 'Robert') then
    raise exception 'Choose the account the refund came from.';
  end if;

  if clean_reason is null or char_length(clean_reason) not between 1 and 500 then
    raise exception 'Enter a refund reason of up to 500 characters.';
  end if;

  select coalesce(sum(amount), 0) into already_refunded
    from public.sale_refunds where receipt_id = payment_id;
  if refund_amount > receipt.amount_paid - already_refunded then
    raise exception 'The refund exceeds the remaining refundable amount on this payment.';
  end if;

  insert into public.sale_refunds (id, created_by, invoice_id, receipt_id, refund_date, amount, bank_account, reason)
  values (refund_id, actor, receipt.invoice_id, payment_id, paid_on, refund_amount, paid_from, clean_reason);
  return refund_id;
end;
$$;

revoke execute on function public.record_sale_refund(uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_sale_refund(uuid, uuid, date, numeric, text, text) to authenticated;

create function public.protect_refunded_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  refunded numeric;
  first_refund date;
begin
  select sum(amount), min(refund_date) into refunded, first_refund
    from public.sale_refunds where receipt_id = old.id;
  if first_refund is not null and (
    new.invoice_id is distinct from old.invoice_id
    or new.amount_paid < refunded
    or new.receipt_date > first_refund
  ) then
    raise exception 'This payment has a recorded refund. Keep it on the same invoice, at or above the refunded amount, and dated no later than its first refund.';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_refunded_receipt() from public, anon, authenticated;

create trigger protect_refunded_receipt
  before update of invoice_id, amount_paid, receipt_date on public.payment_receipts
  for each row execute function public.protect_refunded_receipt();
