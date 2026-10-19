import type { ReportPeriod } from "@/src/lib/financial-report";
import { formatDisplayDate } from "@/src/lib/format-date";

export function isValidVatPeriod(start?: string | null, end?: string | null): boolean {
  const validDate = (value?: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return validDate(start) && validDate(end) && start! <= end!;
}

export function vatPaymentPeriodStatus(
  start: string | null | undefined,
  end: string | null | undefined,
  period: ReportPeriod
): "included" | "unassigned" | "partial" | "outside" {
  if (!isValidVatPeriod(start, end)) return "unassigned";
  if ((period.from && end! < period.from) || (period.to && start! > period.to)) return "outside";
  // Do not assign an entire quarter's payment to only part of that quarter.
  if ((period.from && start! < period.from) || (period.to && end! > period.to)) return "partial";
  return "included";
}

export function vatPeriodLabel(start?: string | null, end?: string | null): string {
  return isValidVatPeriod(start, end)
    ? `${formatDisplayDate(start!)} – ${formatDisplayDate(end!)}`
    : "Period not assigned";
}
