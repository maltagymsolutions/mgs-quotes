"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage } from "@/src/components/app-page";
import {
  amountExcludingVat,
  calculateShipmentProfit,
} from "@/src/lib/shipment-profit";
import { calculateItemsTotals } from "@/src/lib/item-discounts";
import { createClient } from "@/src/lib/supabase-browser";

type ShipmentStatus = "Planning" | "Ordered" | "In transit" | "Received" | "Closed";

type Shipment = {
  id: string;
  created_at: string;
  name: string;
  reference: string | null;
  shipment_date: string | null;
  status: ShipmentStatus;
  notes: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  date_issued: string;
  status: string;
  vat_rate: number;
  discount_amount_incl_vat: number | null;
  shipment_id: string | null;
};

type InvoiceItem = {
  invoice_id: string;
  qty: number;
  sale_price_incl_vat: number;
  item_discount_percent: number | null;
};

type Expense = {
  id: string;
  expense_date: string;
  supplier: string | null;
  description: string;
  category: string;
  vat_rate: number;
  amount_incl_vat: number;
  shipment_id: string | null;
};

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
};

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "Planning",
  "Ordered",
  "In transit",
  "Received",
  "Closed",
];

const SHIPMENTS_SETUP_MESSAGE =
  "Shipments are not set up yet. Run supabase/migrations/014_create_shipments.sql in Supabase, then refresh this page.";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function ShipmentsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [message, setMessage] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [shipmentDate, setShipmentDate] = useState(todayDate());
  const [status, setStatus] = useState<ShipmentStatus>("Planning");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async (preferredShipmentId?: string) => {
    const [
      shipmentsResult,
      invoicesResult,
      invoiceItemsResult,
      expensesResult,
      clientsResult,
    ] = await Promise.all([
      supabase
        .from("shipments")
        .select("*")
        .order("shipment_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, client_id, date_issued, status, vat_rate, discount_amount_incl_vat, shipment_id"
        )
        .order("date_issued", { ascending: false }),
      supabase
        .from("invoice_items")
        .select("invoice_id, qty, sale_price_incl_vat, item_discount_percent"),
      supabase
        .from("expenses")
        .select(
          "id, expense_date, supplier, description, category, vat_rate, amount_incl_vat, shipment_id"
        )
        .neq("category", "VAT")
        .order("expense_date", { ascending: false }),
      supabase.from("clients").select("id, private_name, company_name"),
    ]);

    const setupError =
      shipmentsResult.error?.code === "PGRST205" ||
      invoicesResult.error?.code === "42703" ||
      invoicesResult.error?.code === "PGRST204" ||
      expensesResult.error?.code === "42703" ||
      expensesResult.error?.code === "PGRST204";

    if (setupError) {
      setMessage(SHIPMENTS_SETUP_MESSAGE);
      return;
    }

    const error =
      shipmentsResult.error ||
      invoicesResult.error ||
      invoiceItemsResult.error ||
      expensesResult.error ||
      clientsResult.error;

    if (error) {
      setMessage(error.message);
      return;
    }

    const nextShipments = (shipmentsResult.data || []) as Shipment[];
    const nextInvoices = (invoicesResult.data || []) as Invoice[];
    const nextExpenses = (expensesResult.data || []) as Expense[];
    const requestedShipmentId = preferredShipmentId || selectedShipmentId;
    const nextSelectedShipmentId = nextShipments.some(
      (shipment) => shipment.id === requestedShipmentId
    )
      ? requestedShipmentId
      : nextShipments[0]?.id || "";

    setShipments(nextShipments);
    setInvoices(nextInvoices);
    setInvoiceItems((invoiceItemsResult.data || []) as InvoiceItem[]);
    setExpenses(nextExpenses);
    setClients((clientsResult.data || []) as Client[]);
    setSelectedShipmentId(nextSelectedShipmentId);
    setSelectedInvoiceIds(
      nextInvoices
        .filter((invoice) => invoice.shipment_id === nextSelectedShipmentId)
        .map((invoice) => invoice.id)
    );
    setSelectedExpenseIds(
      nextExpenses
        .filter((expense) => expense.shipment_id === nextSelectedShipmentId)
        .map((expense) => expense.id)
    );
    setMessage("");
  }, [selectedShipmentId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.id === selectedShipmentId) || null,
    [selectedShipmentId, shipments]
  );

  const assignedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)),
    [invoices, selectedInvoiceIds]
  );

  const assignedExpenses = useMemo(
    () => expenses.filter((expense) => selectedExpenseIds.includes(expense.id)),
    [expenses, selectedExpenseIds]
  );

  const totals = useMemo(
    () => calculateShipmentProfit(assignedInvoices, invoiceItems, assignedExpenses),
    [assignedExpenses, assignedInvoices, invoiceItems]
  );

  function clientName(clientId: string | null) {
    const client = clients.find((row) => row.id === clientId);
    return client?.company_name || client?.private_name || "Unknown client";
  }

  function invoiceTotal(invoice: Invoice) {
    const itemTotals = calculateItemsTotals(
      invoiceItems.filter((item) => item.invoice_id === invoice.id)
    );
    const discount = Math.min(
      Number(invoice.discount_amount_incl_vat || 0),
      itemTotals.totalAfterItemDiscounts
    );
    return Math.round((itemTotals.totalAfterItemDiscounts - discount) * 100) / 100;
  }

  function clearForm() {
    setEditingShipmentId(null);
    setName("");
    setReference("");
    setShipmentDate(todayDate());
    setStatus("Planning");
    setNotes("");
  }

  function selectShipment(shipmentId: string) {
    setSelectedShipmentId(shipmentId);
    setSelectedInvoiceIds(
      invoices
        .filter((invoice) => invoice.shipment_id === shipmentId)
        .map((invoice) => invoice.id)
    );
    setSelectedExpenseIds(
      expenses
        .filter((expense) => expense.shipment_id === shipmentId)
        .map((expense) => expense.id)
    );
  }

  function editShipment(shipment: Shipment) {
    setEditingShipmentId(shipment.id);
    setName(shipment.name);
    setReference(shipment.reference || "");
    setShipmentDate(shipment.shipment_date || todayDate());
    setStatus(shipment.status);
    setNotes(shipment.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveShipment() {
    if (!name.trim()) {
      setMessage("Enter a shipment name.");
      return;
    }

    const payload = {
      name: name.trim(),
      reference: reference.trim() || null,
      shipment_date: shipmentDate || null,
      status,
      notes: notes.trim() || null,
    };

    const result = editingShipmentId
      ? await supabase.from("shipments").update(payload).eq("id", editingShipmentId)
      : await supabase.from("shipments").insert(payload).select("id").single();

    if (result.error) {
      setMessage(
        result.error.code === "PGRST205" ? SHIPMENTS_SETUP_MESSAGE : result.error.message
      );
      return;
    }

    const createdId =
      !editingShipmentId && result.data && "id" in result.data
        ? String(result.data.id)
        : editingShipmentId;

    clearForm();
    setMessage(editingShipmentId ? "Shipment updated." : "Shipment created.");
    await loadData(createdId || undefined);
  }

  async function deleteShipment(shipment: Shipment) {
    if (!window.confirm(`Delete shipment "${shipment.name}"? Assigned records will be unlinked.`)) {
      return;
    }

    const { error } = await supabase.from("shipments").delete().eq("id", shipment.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingShipmentId === shipment.id) clearForm();
    setMessage("Shipment deleted.");
    await loadData();
  }

  function toggleInvoice(invoice: Invoice) {
    if (invoice.shipment_id && invoice.shipment_id !== selectedShipmentId) return;
    setSelectedInvoiceIds((current) =>
      current.includes(invoice.id)
        ? current.filter((id) => id !== invoice.id)
        : [...current, invoice.id]
    );
  }

  function toggleExpense(expense: Expense) {
    if (expense.shipment_id && expense.shipment_id !== selectedShipmentId) return;
    setSelectedExpenseIds((current) =>
      current.includes(expense.id)
        ? current.filter((id) => id !== expense.id)
        : [...current, expense.id]
    );
  }

  async function saveAssignments() {
    if (!selectedShipmentId) return;

    setMessage("Saving shipment assignments...");

    const currentInvoiceIds = invoices
      .filter((invoice) => invoice.shipment_id === selectedShipmentId)
      .map((invoice) => invoice.id);
    const currentExpenseIds = expenses
      .filter((expense) => expense.shipment_id === selectedShipmentId)
      .map((expense) => expense.id);

    const invoiceIdsToAdd = selectedInvoiceIds.filter(
      (id) => !currentInvoiceIds.includes(id)
    );
    const invoiceIdsToRemove = currentInvoiceIds.filter(
      (id) => !selectedInvoiceIds.includes(id)
    );
    const expenseIdsToAdd = selectedExpenseIds.filter(
      (id) => !currentExpenseIds.includes(id)
    );
    const expenseIdsToRemove = currentExpenseIds.filter(
      (id) => !selectedExpenseIds.includes(id)
    );

    const updates = [];
    if (invoiceIdsToAdd.length) {
      updates.push(
        supabase
          .from("invoices")
          .update({ shipment_id: selectedShipmentId })
          .in("id", invoiceIdsToAdd)
      );
    }
    if (invoiceIdsToRemove.length) {
      updates.push(
        supabase.from("invoices").update({ shipment_id: null }).in("id", invoiceIdsToRemove)
      );
    }
    if (expenseIdsToAdd.length) {
      updates.push(
        supabase
          .from("expenses")
          .update({ shipment_id: selectedShipmentId })
          .in("id", expenseIdsToAdd)
      );
    }
    if (expenseIdsToRemove.length) {
      updates.push(
        supabase.from("expenses").update({ shipment_id: null }).in("id", expenseIdsToRemove)
      );
    }

    const results = await Promise.all(updates);
    const error = results.find((result) => result.error)?.error;
    if (error) {
      setMessage(
        error.code === "42703" || error.code === "PGRST204"
          ? SHIPMENTS_SETUP_MESSAGE
          : error.message
      );
      return;
    }

    setMessage("Shipment assignments saved.");
    await loadData();
  }

  return (
    <AppPage
      title="Shipments"
      description="Group customer invoices and supplier expenses into one shipment profitability view."
      actions={
        <>
          <Link href="/invoices" className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-3 text-sm font-bold !text-white no-underline">
            Invoices
          </Link>
          <Link href="/expenses" className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-3 text-sm font-bold !text-white no-underline">
            Expenses
          </Link>
        </>
      }
    >

      {message ? (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#ffffff",
          }}
        >
          {message}
        </div>
      ) : null}

      <section style={{ padding: 20, marginBottom: 24 }}>
        <h2>{editingShipmentId ? "Edit Shipment" : "Create Shipment"}</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
            gap: 14,
          }}
        >
          <div>
            <label>Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="June equipment order"
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            />
          </div>
          <div>
            <label>Supplier reference</label>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            />
          </div>
          <div>
            <label>Shipment date</label>
            <input
              type="date"
              value={shipmentDate}
              onChange={(event) => setShipmentDate(event.target.value)}
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            />
          </div>
          <div>
            <label>Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ShipmentStatus)}
              style={{ width: "100%", padding: 12, marginTop: 6 }}
            >
              {SHIPMENT_STATUSES.map((shipmentStatus) => (
                <option key={shipmentStatus} value={shipmentStatus}>
                  {shipmentStatus}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            style={{ width: "100%", padding: 12, marginTop: 6 }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={saveShipment} style={{ padding: "10px 14px" }}>
            {editingShipmentId ? "Update Shipment" : "Create Shipment"}
          </button>
          {editingShipmentId ? (
            <button
              onClick={clearForm}
              style={{
                padding: "10px 14px",
                background: "#ffffff",
                color: "#111827",
                borderColor: "#d1d5db",
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      <section style={{ padding: 20, marginBottom: 24 }}>
        <h2>Saved Shipments</h2>
        {shipments.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No shipments created yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: 10, textAlign: "left" }}>Name</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Reference</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Date</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Status</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", fontWeight: 700 }}>
                      {shipment.name}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                      {shipment.reference || "-"}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                      {shipment.shipment_date || "-"}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                      {shipment.status}
                    </td>
                    <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => selectShipment(shipment.id)}
                          style={{ padding: "8px 10px" }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => editShipment(shipment)}
                          style={{
                            padding: "8px 10px",
                            background: "#ffffff",
                            color: "#111827",
                            borderColor: "#d1d5db",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteShipment(shipment)}
                          style={{
                            padding: "8px 10px",
                            background: "#ffffff",
                            color: "#991b1b",
                            borderColor: "#fecaca",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedShipment ? (
        <>
          <section style={{ padding: 20, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ marginBottom: 5 }}>{selectedShipment.name}</h2>
                <div style={{ color: "#6b7280" }}>
                  {selectedShipment.reference || "No supplier reference"} · {selectedShipment.status}
                </div>
              </div>
              <button onClick={saveAssignments} style={{ padding: "10px 14px" }}>
                Save Assignments
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
                gap: 16,
              }}
            >
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Revenue excl. VAT</div>
                <strong style={{ fontSize: 22 }}>{money(totals.revenueExclVat)}</strong>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Costs excl. VAT</div>
                <strong style={{ fontSize: 22 }}>{money(totals.costExclVat)}</strong>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Profit</div>
                <strong
                  style={{ fontSize: 22, color: totals.profit < 0 ? "#b91c1c" : "#166534" }}
                >
                  {money(totals.profit)}
                </strong>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Margin</div>
                <strong style={{ fontSize: 22 }}>{totals.marginPercent.toFixed(2)}%</strong>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Sales VAT</div>
                <strong>{money(totals.salesVat)}</strong>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>Input VAT</div>
                <strong>{money(totals.inputVat)}</strong>
              </div>
            </div>
          </section>

          <section style={{ padding: 20, marginBottom: 24 }}>
            <h2>Income Invoices</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10, textAlign: "left" }}>Include</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Invoice</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Client</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Date</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Status</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Incl. VAT</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Excl. VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const assignedElsewhere =
                      !!invoice.shipment_id && invoice.shipment_id !== selectedShipmentId;
                    const total = invoiceTotal(invoice);
                    return (
                      <tr key={invoice.id}>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(invoice.id)}
                            disabled={assignedElsewhere}
                            onChange={() => toggleInvoice(invoice)}
                          />
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", fontWeight: 700 }}>
                          {invoice.invoice_number}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {clientName(invoice.client_id)}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {invoice.date_issued}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {assignedElsewhere ? "Other shipment" : invoice.status}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
                          {money(total)}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
                          {money(amountExcludingVat(total, Number(invoice.vat_rate || 0)))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ padding: 20 }}>
            <h2>Shipment Expenses</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10, textAlign: "left" }}>Include</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Date</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Supplier</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Description</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Category</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Incl. VAT</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Excl. VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const assignedElsewhere =
                      !!expense.shipment_id && expense.shipment_id !== selectedShipmentId;
                    return (
                      <tr key={expense.id}>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          <input
                            type="checkbox"
                            checked={selectedExpenseIds.includes(expense.id)}
                            disabled={assignedElsewhere}
                            onChange={() => toggleExpense(expense)}
                          />
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {expense.expense_date}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {expense.supplier || "-"}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {expense.description}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb" }}>
                          {assignedElsewhere ? "Other shipment" : expense.category}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
                          {money(expense.amount_incl_vat)}
                        </td>
                        <td style={{ padding: 10, borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
                          {money(
                            amountExcludingVat(
                              Number(expense.amount_incl_vat || 0),
                              Number(expense.vat_rate || 0)
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </AppPage>
  );
}
