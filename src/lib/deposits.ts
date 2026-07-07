export function isPartialDeposit(depositPercent: number | string | null | undefined) {
  const numericDepositPercent = Number(depositPercent || 0);
  return numericDepositPercent > 0 && numericDepositPercent < 100;
}
