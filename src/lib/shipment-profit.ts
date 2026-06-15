import { calculateItemsTotals, roundMoney } from "@/src/lib/item-discounts";

export type ShipmentInvoice = {
  id: string;
  vat_rate: number | string;
  discount_amount_incl_vat?: number | string | null;
};

export type ShipmentInvoiceItem = {
  invoice_id: string;
  qty: number | string;
  sale_price_incl_vat: number | string;
  item_discount_percent?: number | string | null;
};

export type ShipmentExpense = {
  amount_incl_vat: number | string;
  vat_rate: number | string;
};

export function amountExcludingVat(amountInclVat: number, vatRate: number) {
  return roundMoney(amountInclVat / (1 + vatRate / 100));
}

export function calculateShipmentProfit(
  invoices: ShipmentInvoice[],
  invoiceItems: ShipmentInvoiceItem[],
  expenses: ShipmentExpense[]
) {
  const sales = invoices.reduce(
    (totals, invoice) => {
      const items = invoiceItems.filter((item) => item.invoice_id === invoice.id);
      const itemTotals = calculateItemsTotals(items);
      const discount = roundMoney(
        Math.min(
          Number(invoice.discount_amount_incl_vat || 0),
          itemTotals.totalAfterItemDiscounts
        )
      );
      const revenueInclVat = roundMoney(itemTotals.totalAfterItemDiscounts - discount);
      const revenueExclVat = amountExcludingVat(
        revenueInclVat,
        Number(invoice.vat_rate || 0)
      );

      return {
        revenueInclVat: roundMoney(totals.revenueInclVat + revenueInclVat),
        revenueExclVat: roundMoney(totals.revenueExclVat + revenueExclVat),
        salesVat: roundMoney(totals.salesVat + revenueInclVat - revenueExclVat),
      };
    },
    { revenueInclVat: 0, revenueExclVat: 0, salesVat: 0 }
  );

  const costs = expenses.reduce(
    (totals, expense) => {
      const costInclVat = roundMoney(Number(expense.amount_incl_vat || 0));
      const costExclVat = amountExcludingVat(
        costInclVat,
        Number(expense.vat_rate || 0)
      );

      return {
        costInclVat: roundMoney(totals.costInclVat + costInclVat),
        costExclVat: roundMoney(totals.costExclVat + costExclVat),
        inputVat: roundMoney(totals.inputVat + costInclVat - costExclVat),
      };
    },
    { costInclVat: 0, costExclVat: 0, inputVat: 0 }
  );

  const profit = roundMoney(sales.revenueExclVat - costs.costExclVat);
  const marginPercent =
    sales.revenueExclVat > 0
      ? roundMoney((profit / sales.revenueExclVat) * 100)
      : 0;

  return {
    ...sales,
    ...costs,
    profit,
    marginPercent,
  };
}
