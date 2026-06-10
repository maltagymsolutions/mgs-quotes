do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'expenses'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%category%'
  loop
    execute format('alter table public.expenses drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.expenses
  add constraint expenses_category_check
  check (
    category in ('Equipment', 'Professional fees', 'Tax', 'Shipping', 'VAT', 'Advertising')
  );
