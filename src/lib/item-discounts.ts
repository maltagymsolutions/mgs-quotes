export type DiscountableItem = {
  qty: number | string;
  sale_price_incl_vat: number | string;
  item_discount_percent?: number | string | null;
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeDiscountPercent(value: number | string | null | undefined) {
  return Math.min(Math.max(Number(value || 0), 0), 100);
}

export function calculateItemLineTotals(item: DiscountableItem) {
  const grossBeforeDiscount = roundMoney(
    Number(item.sale_price_incl_vat || 0) * Number(item.qty || 0)
  );
  const discountPercent = normalizeDiscountPercent(item.item_discount_percent);
  const discountAmount = roundMoney(grossBeforeDiscount * (discountPercent / 100));

  return {
    grossBeforeDiscount,
    discountPercent,
    discountAmount,
    totalAfterDiscount: roundMoney(grossBeforeDiscount - discountAmount),
  };
}

export function calculateItemsTotals(items: DiscountableItem[]) {
  return items.reduce(
    (totals, item) => {
      const line = calculateItemLineTotals(item);

      return {
        grossBeforeItemDiscounts: roundMoney(
          totals.grossBeforeItemDiscounts + line.grossBeforeDiscount
        ),
        itemDiscountTotal: roundMoney(totals.itemDiscountTotal + line.discountAmount),
        totalAfterItemDiscounts: roundMoney(
          totals.totalAfterItemDiscounts + line.totalAfterDiscount
        ),
      };
    },
    {
      grossBeforeItemDiscounts: 0,
      itemDiscountTotal: 0,
      totalAfterItemDiscounts: 0,
    }
  );
}
