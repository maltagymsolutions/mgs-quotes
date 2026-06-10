export function formatQuantitySaveError(message: string) {
  if (message.includes("invalid input syntax for type integer")) {
    return "Decimal quantities are not enabled in Supabase yet. Run supabase/migrations/012_ensure_decimal_item_quantities.sql, then try again.";
  }

  return message;
}
