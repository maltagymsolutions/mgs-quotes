type CardPaymentBrand = {
  label: string;
  src: string;
  width: number;
  height: number;
};

export const CARD_PAYMENT_BRANDS: CardPaymentBrand[] = [
  { label: "Visa", src: "/card-payments/visa.png", width: 43, height: 13 },
  { label: "Mastercard", src: "/card-payments/mastercard.png", width: 55, height: 13 },
  { label: "Apple Pay", src: "/card-payments/apple-pay.png", width: 42, height: 17 },
];

export function normalizeExternalUrl(value: string) {
  const trimmedValue = value.trim();
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  return `https://${trimmedValue}`;
}
