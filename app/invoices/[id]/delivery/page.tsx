"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
};

type Client = {
  company_name: string | null;
  private_name: string | null;
  address: string | null;
};

type InvoiceItem = {
  id: string;
  name: string;
  qty: number | string;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function quantityLabel(qty: number | string) {
  return Number(qty || 0).toLocaleString("en-MT", {
    maximumFractionDigits: 2,
  });
}

export default function DeliveryReceiptSetupPage({ params }: PageProps) {
  const supabase = useMemo(() => createClient(), []);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayDate());
  const [conditions, setConditions] = useState([
    "Delivered in good condition",
    "Installed and tested",
  ]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setInvoiceId(resolved.id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!invoiceId) return;

    async function loadInvoice() {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_id")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoiceData) {
        setMessage("Invoice not found.");
        setLoading(false);
        return;
      }

      const [{ data: clientData }, { data: itemData, error: itemError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select("company_name, private_name, address")
            .eq("id", invoiceData.client_id)
            .single(),
          supabase
            .from("invoice_items")
            .select("id, name, qty")
            .eq("invoice_id", invoiceData.id),
        ]);

      if (itemError) {
        setMessage(itemError.message);
        setLoading(false);
        return;
      }

      const loadedItems = (itemData || []) as InvoiceItem[];
      const loadedClient = (clientData || null) as Client | null;

      setInvoice(invoiceData as Invoice);
      setClient(loadedClient);
      setItems(loadedItems);
      setSelectedItemIds(loadedItems.map((item) => item.id));
      setCustomerName(
        loadedClient?.company_name || loadedClient?.private_name || ""
      );
      setDeliveryAddress(loadedClient?.address || "");
      setLoading(false);
    }

    loadInvoice();
  }, [invoiceId, supabase]);

  const pdfUrl = useMemo(() => {
    if (!invoice) return "";

    const search = new URLSearchParams({
      customerName: customerName.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryDate,
    });

    selectedItemIds.forEach((itemId) => search.append("itemId", itemId));
    conditions
      .map((condition) => condition.trim())
      .filter(Boolean)
      .forEach((condition) => search.append("condition", condition));

    return `/api/invoices/${invoice.id}/delivery-receipt/pdf?${search.toString()}`;
  }, [
    conditions,
    customerName,
    deliveryAddress,
    deliveryDate,
    invoice,
    selectedItemIds,
  ]);

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  }

  function updateCondition(index: number, value: string) {
    setConditions((current) =>
      current.map((condition, conditionIndex) =>
        conditionIndex === index ? value : condition
      )
    );
  }

  function removeCondition(index: number) {
    setConditions((current) =>
      current.filter((_, conditionIndex) => conditionIndex !== index)
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href={`/invoices/${invoiceId}`}>← Back to invoice</Link>
        <h1 style={{ marginTop: 20 }}>Loading delivery receipt...</h1>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/invoices">← Back to invoices</Link>
        <h1 style={{ marginTop: 20 }}>Delivery Receipt</h1>
        <p>{message || "Invoice not found."}</p>
      </main>
    );
  }

  const canGenerate = Boolean(
    customerName.trim() &&
      deliveryAddress.trim() &&
      deliveryDate &&
      selectedItemIds.length > 0
  );

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 940 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/invoices/${invoice.id}`}>← Back to invoice</Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1>Delivery Confirmation Receipt</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Invoice {invoice.invoice_number}
          {client
            ? ` · ${client.company_name || client.private_name || "Client"}`
            : ""}
        </p>
      </div>

      <section style={{ padding: 20, marginBottom: 24 }}>
        <h2>Delivery Details</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: 14,
          }}
        >
          <div>
            <label>Customer Name</label>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            />
          </div>
          <div>
            <label>Date of Delivery</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label>Delivery Address</label>
          <textarea
            value={deliveryAddress}
            onChange={(event) => setDeliveryAddress(event.target.value)}
            style={{ width: "100%", padding: 12, marginTop: 6 }}
          />
        </div>
      </section>

      <section style={{ padding: 20, marginBottom: 24 }}>
        <h2>Items Delivered</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <label
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            >
              <input
                type="checkbox"
                checked={selectedItemIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
              />
              <span>
                <strong>{quantityLabel(item.qty)} ×</strong> {item.name}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section style={{ padding: 20, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0 }}>Condition Upon Delivery</h2>
          <button
            onClick={() => setConditions((current) => [...current, ""])}
            style={{
              padding: "8px 11px",
              background: "#ffffff",
              color: "#111827",
              borderColor: "#d1d5db",
            }}
          >
            Add Condition
          </button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {conditions.map((condition, index) => (
            <div
              key={index}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
            >
              <input
                value={condition}
                onChange={(event) => updateCondition(index, event.target.value)}
                style={{ width: "100%", padding: 12 }}
              />
              <button
                onClick={() => removeCondition(index)}
                aria-label={`Remove condition ${index + 1}`}
                title="Remove condition"
                style={{
                  padding: "8px 12px",
                  background: "#ffffff",
                  color: "#991b1b",
                  borderColor: "#fecaca",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {!canGenerate ? (
        <p style={{ color: "#991b1b" }}>
          Enter the customer name, delivery address and date, and select at least one
          item.
        </p>
      ) : null}

      <a
        href={canGenerate ? pdfUrl : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!canGenerate}
        style={{
          display: "inline-block",
          padding: "11px 15px",
          borderRadius: 8,
          background: canGenerate ? "#111827" : "#9ca3af",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 700,
          pointerEvents: canGenerate ? "auto" : "none",
        }}
      >
        Generate Delivery Receipt PDF
      </a>
    </main>
  );
}
