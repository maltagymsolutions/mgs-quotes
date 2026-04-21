"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
  is_business_client: boolean;
};

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  sale_price_incl_vat: number;
};

type InvoiceItemDraft = {
  inventory_item_id: string;
  sku: string;
  name: string;
  qty: number;
  cost_price: number;
  sale_price_incl_vat: number;
};

type SavedInvoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  date_issued: string;
  status: string;
  vat_rate: number;
  deposit_percent: number;
  shipping_cost_incl_vat: number | null;
  discount_amount_incl_vat: number | null;
  notes: string | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  inventory_item_id: string | null;
  sku: string | null;
  name: string;
  qty: number;
  cost_price: number;
  sale_price_incl_vat: number;
};

type CompanySettings = {
  id: string;
  company_name: string;
  invoice_prefix: string;
  next_invoice_number: number;
};

const INVOICE_STATUSES = ["Unpaid", "Deposit Paid", "Fully Paid", "Archived"] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildInvoiceNumber(prefix: string, nextNumber: number) {
  const year = String(new Date().getFullYear()).slice(-2);
  return `${prefix}-${year}-${nextNumber}`;
}

const DEFAULT_NOTES = "Price includes ground floor delivery and installation";

export default function InvoicesPage() {
  const supabase = createClient();

  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [vatRate, setVatRate] = useState(18);
  const [depositPercent, setDepositPercent] = useState(50);
  const [shippingCostInclVat, setShippingCostInclVat] = useState(0);
  const [discountAmountInclVat, setDiscountAmountInclVat] = useState(0);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemDraft[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [inventorySearchTerm, setInventorySearchTerm] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("All");
  const [inventorySortBy, setInventorySortBy] = useState("name-asc");

  useEffect(() => {
    loadClients();
    loadInventory();
    loadInvoices();
    loadCompanySettings();
  }, []);

  async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setClients(data || []);
  }

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInventory(data || []);
  }

  async function loadInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSavedInvoices(data || []);
  }

  async function loadCompanySettings() {
    const { data, error } = await supabase
      .from("company_settings")
      .select("id, company_name, invoice_prefix, next_invoice_number")
      .limit(1)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setCompanySettings(data);
  }

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const isBusinessClient = !!selectedClient?.is_business_client;

  function clearEditor() {
    setEditingInvoiceId(null);
    setSelectedClientId("");
    setVatRate(18);
    setDepositPercent(50);
    setShippingCostInclVat(0);
    setDiscountAmountInclVat(0);
    setNotes(DEFAULT_NOTES);
    setInvoiceItems([]);
    setSelectedInventoryId("");
    setInventorySearchTerm("");
    setInventoryCategoryFilter("All");
    setInventorySortBy("name-asc");
  }

  async function startEditingInvoice(invoice: SavedInvoice) {
    setMessage("Loading invoice for editing...");

    const { data: rows, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const draftItems: InvoiceItemDraft[] = (rows || []).map((item: InvoiceItemRow) => ({
      inventory_item_id: item.inventory_item_id || "",
      sku: item.sku || "",
      name: item.name,
      qty: Number(item.qty),
      cost_price: Number(item.cost_price),
      sale_price_incl_vat: Number(item.sale_price_incl_vat),
    }));

    setEditingInvoiceId(invoice.id);
    setSelectedClientId(invoice.client_id || "");
    setVatRate(Number(invoice.vat_rate));
    setDepositPercent(Number(invoice.deposit_percent));
    setShippingCostInclVat(Number(invoice.shipping_cost_incl_vat || 0));
    setDiscountAmountInclVat(Number(invoice.discount_amount_incl_vat || 0));
    setNotes(invoice.notes || DEFAULT_NOTES);
    setInvoiceItems(draftItems);
    setSelectedInventoryId("");
    setMessage(`Editing ${invoice.invoice_number}`);
  }

  function addSelectedInventoryItem() {
    const item = inventory.find((i) => i.id === selectedInventoryId);
    if (!item) return;

    setInvoiceItems((prev) => {
      const existing = prev.find((p) => p.inventory_item_id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.inventory_item_id === item.id ? { ...p, qty: p.qty + 1 } : p
        );
      }

      return [
        ...prev,
        {
          inventory_item_id: item.id,
          sku: item.sku,
          name: item.name,
          qty: 1,
          cost_price: Number(item.cost_price),
          sale_price_incl_vat: Number(item.sale_price_incl_vat),
        },
      ];
    });
  }

  function updateQty(index: number, qty: number) {
    setInvoiceItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, qty: qty < 1 ? 1 : qty } : item))
    );
  }

  function removeItem(index: number) {
    setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  }
  

  
  function moveItem(index: number, direction: "up" | "down") {
    setInvoiceItems((prev) => {
      const newItems = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
  
      if (targetIndex < 0 || targetIndex >= newItems.length) {
        return prev;
      }
  
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
  
      return newItems;
    });
  }

 const totals = useMemo(() => {
    const grossBeforeDiscount = round2(
      invoiceItems.reduce(
        (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
        0
      )
    );
  
    const discountApplied = round2(
      Math.min(Number(discountAmountInclVat || 0), grossBeforeDiscount)
    );
  
    const grossTotal = round2(grossBeforeDiscount - discountApplied);
  
  const salesVatAmount = round2(
      grossTotal - grossTotal / (1 + vatRate / 100)
    );
    
    const subtotal = isBusinessClient
      ? round2(grossBeforeDiscount / (1 + vatRate / 100))
      : grossBeforeDiscount;
  
    const totalCost = round2(
      invoiceItems.reduce(
        (sum, item) => sum + Number(item.cost_price) * Number(item.qty),
        0
      )
    );
  
    const shippingVatAmount = round2(
      Number(shippingCostInclVat || 0) -
        Number(shippingCostInclVat || 0) / (1 + vatRate / 100)
    );
  
    const profit = round2(
      grossTotal - salesVatAmount - Number(shippingCostInclVat || 0) + shippingVatAmount - totalCost
    );
  
    const depositAmount = round2(grossTotal * (depositPercent / 100));
  
    return {
      subtotal,
      vatAmount: salesVatAmount,
      grossBeforeDiscount,
      discountApplied,
      grossTotal,
      totalCost,
      shippingVatAmount,
      profit,
      depositAmount,
    };
  }, [invoiceItems, vatRate, depositPercent, isBusinessClient, shippingCostInclVat, discountAmountInclVat]);
  
  const filteredInventoryOptions = useMemo(() => {
    let items = [...inventory];
  
    if (inventorySearchTerm.trim()) {
      const q = inventorySearchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          ((item as any).category || "").toLowerCase().includes(q)
      );
    }
  
    if (inventoryCategoryFilter !== "All") {
      items = items.filter(
        (item) => (((item as any).category || "Other") === inventoryCategoryFilter)
      );
    }
  
    if (inventorySortBy === "name-asc") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (inventorySortBy === "name-desc") {
      items.sort((a, b) => b.name.localeCompare(a.name));
    } else if (inventorySortBy === "sku-asc") {
      items.sort((a, b) => a.sku.localeCompare(b.sku));
    } else if (inventorySortBy === "price-low") {
      items.sort((a, b) => a.sale_price_incl_vat - b.sale_price_incl_vat);
    } else if (inventorySortBy === "price-high") {
      items.sort((a, b) => b.sale_price_incl_vat - a.sale_price_incl_vat);
    }
  
    return items;
  }, [inventory, inventorySearchTerm, inventoryCategoryFilter, inventorySortBy]);

  async function saveInvoice() {
    if (!companySettings && !editingInvoiceId) {
      setMessage("Company settings not loaded.");
      return;
    }

    if (!selectedClientId) {
      setMessage("Please choose a client.");
      return;
    }

    if (invoiceItems.length === 0) {
      setMessage("Please add at least one item.");
      return;
    }

    if (editingInvoiceId) {
      setMessage("Updating invoice...");

      const { error: invoiceUpdateError } = await supabase
        .from("invoices")
        .update({
          client_id: selectedClientId,
          vat_rate: vatRate,
          deposit_percent: depositPercent,
          shipping_cost_incl_vat: shippingCostInclVat,
          discount_amount_incl_vat: discountAmountInclVat,
          notes: notes || null,
        })
        .eq("id", editingInvoiceId);

      if (invoiceUpdateError) {
        setMessage(invoiceUpdateError.message);
        return;
      }

      const { error: deleteItemsError } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", editingInvoiceId);

      if (deleteItemsError) {
        setMessage(deleteItemsError.message);
        return;
      }

      const itemsToInsert = invoiceItems.map((item) => ({
        invoice_id: editingInvoiceId,
        inventory_item_id: item.inventory_item_id || null,
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        cost_price: item.cost_price,
        sale_price_incl_vat: item.sale_price_incl_vat,
      }));

      const { error: insertItemsError } = await supabase.from("invoice_items").insert(itemsToInsert);

      if (insertItemsError) {
        setMessage(insertItemsError.message);
        return;
      }

      setMessage("Invoice updated.");
      clearEditor();
      await loadInvoices();
      return;
    }

    setMessage("Saving invoice...");

    const invoiceNumber = buildInvoiceNumber(
      companySettings!.invoice_prefix,
      companySettings!.next_invoice_number
    );

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: selectedClientId,
        date_issued: new Date().toISOString().slice(0, 10),
        vat_rate: vatRate,
        deposit_percent: depositPercent,
        shipping_cost_incl_vat: shippingCostInclVat,
        discount_amount_incl_vat: discountAmountInclVat,
        notes: notes || null,
        status: "Unpaid",
      })
      .select()
      .single();

    if (invoiceError) {
      setMessage(invoiceError.message);
      return;
    }

    const itemsToInsert = invoiceItems.map((item) => ({
      invoice_id: invoiceData.id,
      inventory_item_id: item.inventory_item_id || null,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      cost_price: item.cost_price,
      sale_price_incl_vat: item.sale_price_incl_vat,
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);

    if (itemsError) {
      setMessage(itemsError.message);
      return;
    }

    const { error: settingsError } = await supabase
      .from("company_settings")
      .update({ next_invoice_number: companySettings!.next_invoice_number + 1 })
      .eq("id", companySettings!.id);

    if (settingsError) {
      setMessage(settingsError.message);
      return;
    }

    setMessage(`Invoice saved: ${invoiceNumber}`);
    clearEditor();
    await loadInvoices();
    await loadCompanySettings();
  }

  function getClientName(clientId: string | null) {
    if (!clientId) return "";
    const client = clients.find((c) => c.id === clientId);
    return client?.company_name || client?.private_name || "Unknown client";
  }
  
  async function updateInvoiceStatus(invoiceId: string, status: string) {
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoiceId);
  
    if (error) {
      setMessage(error.message);
      return;
    }
  
    setMessage(`Invoice status updated to ${status}.`);
    await loadInvoices();
  }
  
  async function archiveInvoice(invoiceId: string) {
    const confirmed = window.confirm("Archive this invoice?");
    if (!confirmed) return;
  
    setMessage("Archiving invoice...");
    await updateInvoiceStatus(invoiceId, "Archived");
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/">← Back to dashboard</Link>
      </div>

      <h1>Invoices</h1>

      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <p>
          Next invoice number:{" "}
          <strong>
            {companySettings
              ? buildInvoiceNumber(companySettings.invoice_prefix, companySettings.next_invoice_number)
              : "Loading..."}
          </strong>
        </p>
      </div>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 20 }}>
        <h2>{editingInvoiceId ? "Edit Invoice" : "Invoice Details"}</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Client</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.private_name || "Unnamed client"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>VAT Rate %</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value || 0))}
            />
          </div>

          <div>
            <label>Deposit %</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              type="number"
              value={depositPercent}
              onChange={(e) => setDepositPercent(Number(e.target.value || 0))}
            />
          </div>

          <div>
            <label>Shipping Cost incl. VAT</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              type="number"
              value={shippingCostInclVat}
              onChange={(e) => setShippingCostInclVat(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label>Discount Amount incl. VAT</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              type="number"
              value={discountAmountInclVat}
              onChange={(e) => setDiscountAmountInclVat(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <label>Notes</label>
            <textarea
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h2>Add Items</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1.2fr) minmax(220px, 1fr) minmax(220px, 1fr)",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div>
            <label>Search</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              placeholder="Search by SKU, name, or category"
              value={inventorySearchTerm}
              onChange={(e) => setInventorySearchTerm(e.target.value)}
            />
          </div>
        
          <div>
            <label>Category</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={inventoryCategoryFilter}
              onChange={(e) => setInventoryCategoryFilter(e.target.value)}
            >
              <option value="All">All categories</option>
              <option value="Treadmills">Treadmills</option>
              <option value="Ellipticals">Ellipticals</option>
              <option value="Indoor Cycling">Indoor Cycling</option>
              <option value="Recumbent Bikes">Recumbent Bikes</option>
              <option value="Rowers">Rowers</option>
              <option value="Strength">Strength</option>
              <option value="Accessories">Accessories</option>
              <option value="Plates">Plates</option>
              <option value="Bars">Bars</option>
              <option value="Dumbbells">Dumbbells</option>
              <option value="Other">Other</option>
            </select>
          </div>
        
          <div>
            <label>Sort</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={inventorySortBy}
              onChange={(e) => setInventorySortBy(e.target.value)}
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="sku-asc">SKU A-Z</option>
              <option value="price-low">Price low to high</option>
              <option value="price-high">Price high to low</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <label>Inventory Item</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={selectedInventoryId}
              onChange={(e) => setSelectedInventoryId(e.target.value)}
            >
              <option value="">Select an item</option>
              {filteredInventoryOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} - {item.name}
                </option>
              ))}
            </select>
          </div>
        
          <button onClick={addSelectedInventoryItem} style={{ padding: "10px 14px" }}>
            Add Item
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          {invoiceItems.length === 0 ? (
            <p>No items added yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>SKU</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Qty</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Sale incl. VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Order</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
               {invoiceItems.map((item, index) => (
                 <tr key={`${item.inventory_item_id}-${index}`}>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, fontWeight: 700 }}>{item.sku}</td>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{item.name}</td>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                     <input
                       type="number"
                       value={item.qty}
                       onChange={(e) => updateQty(index, Number(e.target.value || 1))}
                       style={{ width: 90, padding: 10 }}
                     />
                   </td>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{money(item.sale_price_incl_vat)}</td>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                     <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                       <button
                         onClick={() => moveItem(index, "up")}
                         disabled={index === 0}
                         style={{
                           padding: "8px 12px",
                           background: index === 0 ? "#e5e7eb" : "#ffffff",
                           color: index === 0 ? "#9ca3af" : "#111827",
                           border: "1px solid #d1d5db",
                         }}
                       >
                         Up
                       </button>
                       <button
                         onClick={() => moveItem(index, "down")}
                         disabled={index === invoiceItems.length - 1}
                         style={{
                           padding: "8px 12px",
                           background: index === invoiceItems.length - 1 ? "#e5e7eb" : "#ffffff",
                           color: index === invoiceItems.length - 1 ? "#9ca3af" : "#111827",
                           border: "1px solid #d1d5db",
                         }}
                       >
                         Down
                       </button>
                     </div>
                   </td>
                   <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                     <button
                       onClick={() => removeItem(index)}
                       style={{
                         padding: "8px 12px",
                         background: "#ffffff",
                         color: "#111827",
                         border: "1px solid #d1d5db",
                       }}
                     >
                       Remove
                     </button>
                   </td>
                 </tr>
               ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

     <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h2>Totals</h2>
      
        <div
          style={{
            display: "grid",
            gap: 16,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>Client type</span>
            <strong>{isBusinessClient ? "Business" : "Private"}</strong>
          </div>
        
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              Invoice Summary
            </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>Items total before discount</span>
              <strong>{totals.grossBeforeDiscount.toFixed(2)}</strong>
            </div>
        
            {totals.discountApplied > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7280" }}>Discount incl. VAT</span>
                <strong>-{totals.discountApplied.toFixed(2)}</strong>
              </div>
            ) : null}
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>Invoice total incl. VAT</span>
              <strong>{totals.grossTotal.toFixed(2)}</strong>
            </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>Deposit amount</span>
              <strong>{totals.depositAmount.toFixed(2)}</strong>
            </div>
          </div>
        
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              Tax & Shipping
            </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>
                {isBusinessClient ? "Subtotal excl. VAT" : "Subtotal incl. VAT"}
              </span>              <strong>{totals.subtotal.toFixed(2)}</strong>
            </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>VAT on discounted total</span>              <strong>{totals.vatAmount.toFixed(2)}</strong>
            </div>
        
            {Number(shippingCostInclVat || 0) > 0 ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#6b7280" }}>Shipping incl. VAT</span>
                  <strong>{Number(shippingCostInclVat || 0).toFixed(2)}</strong>
                </div>
        
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#6b7280" }}>VAT on shipping</span>
                  <strong>{totals.shippingVatAmount.toFixed(2)}</strong>
                </div>
              </>
            ) : null}
          </div>
        
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: 14, display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              Internal
            </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#6b7280" }}>Internal cost</span>
              <strong>{totals.totalCost.toFixed(2)}</strong>
            </div>
        
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 2,
                fontSize: 18,
              }}
            >
              <span style={{ fontWeight: 700 }}>Internal profit</span>
              <strong>{totals.profit.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button onClick={saveInvoice} style={{ padding: "10px 14px" }}>
            {editingInvoiceId ? "Update Invoice" : "Save Invoice"}
          </button>
          {editingInvoiceId ? (
            <button onClick={clearEditor} style={{ padding: "10px 14px" }}>
              Cancel Editing
            </button>
          ) : null}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h2>Saved Invoices</h2>

        {savedInvoices.length === 0 ? (
          <p>No invoices saved yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Invoice Number</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Client</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Date</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>View</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Edit</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Archive</th>
              </tr>
            </thead>
            <tbody>
              {savedInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{invoice.invoice_number}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{getClientName(invoice.client_id)}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{invoice.date_issued}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <select
                      value={invoice.status}
                      onChange={(e) => updateInvoiceStatus(invoice.id, e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: 600,
                      }}
                    >
                      {INVOICE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "#111827",
                        color: "#ffffff",
                        textDecoration: "none",
                        fontWeight: 700,
                      }}
                    >
                      View
                    </Link>
                  </td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                    <button
                      onClick={() => startEditingInvoice(invoice)}
                      style={{
                        padding: "8px 12px",
                        background: "#111827",
                        color: "#ffffff",
                        border: "1px solid #111827",
                      }}
                    >
                      Edit
                    </button>
                  </td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                    <button
                      onClick={() => archiveInvoice(invoice.id)}
                      disabled={invoice.status === "Archived"}
                      style={{
                        padding: "8px 12px",
                        background: invoice.status === "Archived" ? "#9ca3af" : "#ffffff",
                        color: invoice.status === "Archived" ? "#ffffff" : "#991b1b",
                        border: invoice.status === "Archived" ? "1px solid #9ca3af" : "1px solid #fca5a5",
                      }}
                    >
                      {invoice.status === "Archived" ? "Archived" : "Archive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
    </main>
  );
}