import { formatFilenameDate } from "@/src/lib/format-date";

type ClientNameSource = {
  company_name?: string | null;
  private_name?: string | null;
} | null;

function sanitizeFilenamePart(value: string | null | undefined, fallback: string) {
  const sanitized = (value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized || fallback;
}

export function buildDocumentPdfFilename({
  dateIssued,
  client,
  documentNumber,
}: {
  dateIssued: string | null | undefined;
  client: ClientNameSource;
  documentNumber: string | number;
}) {
  const datePart = formatFilenameDate(dateIssued);
  const clientName = sanitizeFilenamePart(
    client?.company_name || client?.private_name,
    "Client"
  );
  const numberPart = sanitizeFilenamePart(String(documentNumber), "Document");

  return `${datePart} - MGS - ${clientName} - ${numberPart}.pdf`;
}

export function buildReceiptPdfFilename({
  receiptDate,
  client,
  receiptLabel,
}: {
  receiptDate: string | null | undefined;
  client: ClientNameSource;
  receiptLabel: string;
}) {
  const datePart = formatFilenameDate(receiptDate);
  const clientName = sanitizeFilenamePart(
    client?.company_name || client?.private_name,
    "Client"
  );
  const labelPart = sanitizeFilenamePart(receiptLabel, "Payment Receipt");

  return `${datePart} - MGS - ${clientName} - ${labelPart} Receipt.pdf`;
}

export function buildDeliveryReceiptPdfFilename({
  deliveryDate,
  client,
  invoiceNumber,
}: {
  deliveryDate: string | null | undefined;
  client: ClientNameSource;
  invoiceNumber: string | number;
}) {
  const datePart = formatFilenameDate(deliveryDate);
  const clientName = sanitizeFilenamePart(
    client?.company_name || client?.private_name,
    "Client"
  );
  const invoicePart = sanitizeFilenamePart(String(invoiceNumber), "Invoice");

  return `${datePart} - MGS - ${clientName} - ${invoicePart} Delivery Receipt.pdf`;
}

export function contentDispositionInline(filename: string) {
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "");

  return `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
