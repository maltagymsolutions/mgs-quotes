alter table public.sale_refunds
  add column credit_note_number text,
  add column credit_note_date date,
  add column credit_note_vat_amount numeric(12,2),
  add constraint sale_refunds_credit_note_pair check (
    (credit_note_number is null and credit_note_date is null and credit_note_vat_amount is null)
    or (credit_note_number is not null and credit_note_date is not null and credit_note_vat_amount is not null
      and credit_note_vat_amount between 0 and amount
      and char_length(btrim(credit_note_number)) between 1 and 80)
  );

create index sale_refunds_refund_date_idx on public.sale_refunds(refund_date);
create index sale_refunds_credit_note_date_idx on public.sale_refunds(credit_note_date)
  where credit_note_date is not null;

create function public.link_refund_credit_note(refund_id uuid, note_number text, issued_on date, credited_vat numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_date date;
  refund_amount numeric;
  clean_number text := btrim(note_number);
begin
  if auth.uid() is null then
    raise exception 'Sign in to link a credit note.';
  end if;
  select i.date_issued, r.amount into invoice_date, refund_amount
    from public.sale_refunds r join public.invoices i on i.id = r.invoice_id
    where r.id = refund_id;
  if not found then
    raise exception 'Refund not found.';
  end if;
  if clean_number is null or char_length(clean_number) not between 1 and 80 then
    raise exception 'Enter the issued credit note number.';
  end if;
  if issued_on is null or issued_on < invoice_date
    or issued_on > (now() at time zone 'Europe/Malta')::date then
    raise exception 'Use a credit note date between the invoice date and today.';
  end if;
  if credited_vat is null or credited_vat not between 0 and refund_amount
    or credited_vat <> round(credited_vat, 2) then
    raise exception 'Enter the VAT amount on the note for this refund.';
  end if;

  -- A note can cover several refunds on the same invoice. Serialize checks
  -- on the note number so it cannot accidentally be assigned to another invoice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(clean_number), 0));
  if exists (
    select 1 from public.sale_refunds other
    join public.sale_refunds current_refund on current_refund.id = refund_id
    where other.id <> refund_id and lower(other.credit_note_number) = lower(clean_number)
      and (other.invoice_id <> current_refund.invoice_id or other.credit_note_date <> issued_on)
  ) then
    raise exception 'This credit note number is linked to another invoice or date.';
  end if;
  update public.sale_refunds
    set credit_note_number = clean_number, credit_note_date = issued_on, credit_note_vat_amount = credited_vat
    where id = refund_id;
end;
$$;

revoke execute on function public.link_refund_credit_note(uuid,text,date,numeric) from public, anon;
grant execute on function public.link_refund_credit_note(uuid,text,date,numeric) to authenticated;
