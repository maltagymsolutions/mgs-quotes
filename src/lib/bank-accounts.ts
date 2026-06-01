export const BANK_ACCOUNTS = ["Luke", "Karl", "Robert", "Split"] as const;

export type BankAccount = (typeof BANK_ACCOUNTS)[number];

export const DEFAULT_BANK_ACCOUNT: BankAccount = "Luke";

export function resolveBankAccount(value: string | null | undefined): BankAccount {
  return BANK_ACCOUNTS.includes(value as BankAccount)
    ? (value as BankAccount)
    : DEFAULT_BANK_ACCOUNT;
}
