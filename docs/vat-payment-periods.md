# VAT payment periods

VAT expenses have two dates for the inclusive VAT period being settled, separate from the payment date (`expense_date`). Add or edit a VAT expense in Expenses to set **VAT period from** and **VAT period to**. The actual payment date continues to determine APS cash movements and income/expense reporting.

The screen, PDF and Excel VAT reports all load payments independently of payment date. A payment is deducted only when its entire assigned VAT period lies within the selected report range. Payments that partly overlap the range are listed for review, without prorating; choose the complete VAT period to include them. Payments outside the range are omitted. Unassigned legacy payments are shown for review and are never deducted automatically.

## Deployment

1. Apply `supabase/migrations/022_add_vat_payment_period.sql` to the existing Supabase project before deploying the application. It adds nullable period fields and validates date pairs. Legacy payments remain unassigned until reviewed.
2. Deploy the application code.
3. Edit any remaining unassigned VAT payments and enter the period each settles.
4. Verify the Q2 report includes the July payment and the Q3 report excludes it. Export PDF and Excel to confirm the same allocation.

The migration preserves payment amounts, payment dates, owners and accounts. It is safe to rerun and does not overwrite periods already assigned. Reports fail with a setup message if the database fields have not yet been added.

## Checks

Run `npm run test:vat` for period allocation, instalments, legacy records, partial ranges, hidden purchases, payment pagination and Excel export regression tests. Run `npx tsc --noEmit` and `npm run build` for application validation.
