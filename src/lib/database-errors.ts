type DatabaseError = {
  code?: string;
  message: string;
};

export const APS_BANK_ACCOUNT_MIGRATION_MESSAGE =
  "APS is not allowed by the current Supabase bank account constraint yet. Run supabase/migrations/016_add_aps_bank_account.sql in Supabase, then refresh this page and try again.";

export function formatDatabaseError(error: DatabaseError, setupMessage?: string) {
  if (error.code === "PGRST205" && setupMessage) {
    return setupMessage;
  }

  if (
    error.code === "23514" &&
    (error.message.includes("payment_receipts_bank_account_check") ||
      error.message.includes("expenses_bank_account_check"))
  ) {
    return APS_BANK_ACCOUNT_MIGRATION_MESSAGE;
  }

  return error.message;
}
