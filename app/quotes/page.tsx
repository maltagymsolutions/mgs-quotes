"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  vat_number: string | null;
  is_business_client: boolean;
};

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  sale_price_incl_vat: number;
};

type QuoteItemDraft = {
  inventory_item_id: string;
  sku: string;
  name: string;
  qty: number;
  cost_price: number;
  sale_price_incl_vat: number;
};

type SavedQuote = {
  id: string;
  quote_number: string;
  client_id: string | null;
  date_issued: string;
  vat_rate: number;
  deposit_percent: number;
  shipping_cost_incl_vat: number | null;
  notes: string | null;
  status: string;
};

type QuoteItemRow = {
  id: string;
  quote_id: string;
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
  quote_prefix: string;
  next_quote_number: number;
  invoice_prefix: string;
  next_invoice_number: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildQuoteNumber(prefix: string, nextNumber: number) {
  const year = String(new Date().getFullYear()).slice(-2);
  return `${prefix}-${year}-${nextNumber}`;
}

function buildInvoiceNumber(prefix: string, nextNumber: number) {
  const year = String(new Date().getFullYear()).slice(-2);
  return `${prefix}-${year}-${nextNumber}`;
}

export default function QuotesPage() {
  const supabase = createClient();

  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientPrivateName, setNewClientPrivateName] = useState("");
  const [newClientCompanyName, setNewClientCompanyName] = useState("");
  const [newClientContactPerson, setNewClientContactPerson] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientVatNumber, setNewClientVatNumber] = useState("");
  const [newClientIsBusiness, setNewClientIsBusiness] = useState(false);
  const [vatRate, setVatRate] = useState(18);
  const [depositPercent, setDepositPercent] = useState(50);
  const [shippingCostInclVat, setShippingCostInclVat] = useState(0);
  const [notes, setNotes] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItemDraft[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");

  useEffect(() => {
    loadClients();
    loadInventory();
    loadQuotes();
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

  async function loadQuotes() {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSavedQuotes(data || []);
  }

  async function loadCompanySettings() {
    const { data, error } = await supabase
      .from("company_settings")
      .select("id, company_name, quote_prefix, next_quote_number, invoice_prefix, next_invoice_number")
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

  function clearEditor() {
    setEditingQuoteId(null);
    setSelectedClientId("");
    setShowNewClientForm(false);
    setNewClientPrivateName("");
    setNewClientCompanyName("");
    setNewClientContactPerson("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientAddress("");
    setNewClientVatNumber("");
    setNewClientIsBusiness(false);
    setVatRate(18);
    setDepositPercent(50);
    setShippingCostInclVat(0);
    setNotes("");
    setQuoteItems([]);
    setSelectedInventoryId("");
  }

  async function startEditingQuote(quote: SavedQuote) {
    setMessage("Loading quote for editing...");

    const { data: rows, error } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const draftItems: QuoteItemDraft[] = (rows || []).map((item: QuoteItemRow) => ({
      inventory_item_id: item.inventory_item_id || "",
      sku: item.sku || "",
      name: item.name,
      qty: Number(item.qty),
      cost_price: Number(item.cost_price),
      sale_price_incl_vat: Number(item.sale_price_incl_vat),
    }));

    setEditingQuoteId(quote.id);
    setSelectedClientId(quote.client_id || "");
    setVatRate(Number(quote.vat_rate));
    setDepositPercent(Number(quote.deposit_percent));
    setShippingCostInclVat(Number(quote.shipping_cost_incl_vat || 0));
    setNotes(quote.notes || "");
    setQuoteItems(draftItems);
    setSelectedInventoryId("");
    setMessage(`Editing ${quote.quote_number}`);
  }

  function addSelectedInventoryItem() {
    const item = inventory.find((i) => i.id === selectedInventoryId);
    if (!item) return;

    setQuoteItems((prev) => {
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
    setQuoteItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, qty: qty < 1 ? 1 : qty } : item))
    );
  }

  function removeItem(index: number) {
    setQuoteItems((prev) => prev.filter((_, i) => i !== index));
  }

  const isBusinessClient = !!selectedClient?.is_business_client;

  const totals = useMemo(() => {
    const grossTotal = round2(
      quoteItems.reduce(
        (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
        0
      )
    );
  
    const salesVatAmount = round2(grossTotal - grossTotal / (1 + vatRate / 100));
  
    const subtotal = isBusinessClient
      ? round2(grossTotal / (1 + vatRate / 100))
      : grossTotal;
  
    const totalCost = round2(
      quoteItems.reduce(
        (sum, item) => sum + Number(item.cost_price) * Number(item.qty),
        0
      )
    );
  
    const shippingVatAmount = round2(
      Number(shippingCostInclVat || 0) -
        Number(shippingCostInclVat || 0) / (1 + vatRate / 100)
    );
  
    const shippingExVat = round2(
      Number(shippingCostInclVat || 0) - shippingVatAmount
    );
  
    const profit = round2(
      grossTotal - salesVatAmount - shippingCostInclVat + shippingVatAmount - totalCost
    );
  
    const depositAmount = round2(grossTotal * (depositPercent / 100));
  
    return {
      subtotal,
      vatAmount: salesVatAmount,
      grossTotal,
      totalCost,
      shippingVatAmount,
      shippingExVat,
      profit,
      depositAmount,
    };
  }, [quoteItems, vatRate, depositPercent, isBusinessClient, shippingCostInclVat]);

  async function createClientInline() {
    const displayName = newClientCompanyName || newClientPrivateName;
  
    if (!displayName) {
      setMessage("Please enter at least a private name or company name for the new client.");
      return null;
    }
  
    const normalizedEmail = newClientEmail.trim().toLowerCase();
    const normalizedPrivateName = newClientPrivateName.trim();
    const normalizedCompanyName = newClientCompanyName.trim();
    const normalizedPhone = newClientPhone.trim();
  
    const { data: existingClients, error: existingError } = await supabase
      .from("clients")
      .select("*");
  
    if (existingError) {
      setMessage(existingError.message);
      return null;
    }
  
    const existingMatch = (existingClients || []).find((client) => {
      const clientEmail = (client.email || "").trim().toLowerCase();
      const clientPrivateName = (client.private_name || "").trim();
      const clientCompanyName = (client.company_name || "").trim();
      const clientPhone = (client.phone || "").trim();
  
      const emailMatches = normalizedEmail && clientEmail === normalizedEmail;
      const privateNameMatches =
        normalizedPrivateName &&
        clientPrivateName === normalizedPrivateName &&
        clientPhone === normalizedPhone;
      const companyMatches =
        normalizedCompanyName &&
        clientCompanyName === normalizedCompanyName &&
        clientPhone === normalizedPhone;
  
      return emailMatches || privateNameMatches || companyMatches;
    });
  
    if (existingMatch) {
      return existingMatch.id as string;
    }
  
    const { data, error } = await supabase
      .from("clients")
      .insert({
        private_name: normalizedPrivateName || null,
        company_name: normalizedCompanyName || null,
        contact_person: newClientContactPerson.trim() || null,
        email: normalizedEmail || null,
        phone: normalizedPhone || null,
        address: newClientAddress.trim() || null,
        vat_number: newClientVatNumber.trim() || null,
        is_business_client: newClientIsBusiness,
      })
      .select()
      .single();
  
    if (error) {
      setMessage(error.message);
      return null;
    }
  
    await loadClients();
    return data.id as string;
  }

  async function saveQuote() {

  
    if (!companySettings && !editingQuoteId) {
      setMessage("Company settings not loaded.");
      return;
    }

   let clientIdToUse = selectedClientId;
    
    if (showNewClientForm) {
      setMessage("Creating client...");
      const newClientId = await createClientInline();
      if (!newClientId) {
        return;
      }
      clientIdToUse = newClientId;
    }
    
    if (!clientIdToUse) {
      setMessage("Please choose a client or create a new one.");
      return;
    }

    if (quoteItems.length === 0) {
      setMessage("Please add at least one item.");
      return;
    }

    if (editingQuoteId) {
      setMessage("Updating quote...");

      const { error: quoteUpdateError } = await supabase
        .from("quotes")
        .update({
          client_id: clientIdToUse,
          vat_rate: vatRate,
          deposit_percent: depositPercent,
          shipping_cost_incl_vat: shippingCostInclVat,
          notes: notes || null,
        })
        .eq("id", editingQuoteId);

      if (quoteUpdateError) {
        setMessage(quoteUpdateError.message);
        return;
      }

      const { error: deleteItemsError } = await supabase
        .from("quote_items")
        .delete()
        .eq("quote_id", editingQuoteId);

      if (deleteItemsError) {
        setMessage(deleteItemsError.message);
        return;
      }

      const itemsToInsert = quoteItems.map((item) => ({
        quote_id: editingQuoteId,
        inventory_item_id: item.inventory_item_id || null,
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        cost_price: item.cost_price,
        sale_price_incl_vat: item.sale_price_incl_vat,
      }));

      const { error: insertItemsError } = await supabase.from("quote_items").insert(itemsToInsert);

      if (insertItemsError) {
        setMessage(insertItemsError.message);
        return;
      }

      setMessage("Quote updated.");
      clearEditor();
      await loadQuotes();
      return;
    }

    setMessage("Saving quote...");

    const quoteNumber = buildQuoteNumber(
      companySettings!.quote_prefix,
      companySettings!.next_quote_number
    );

    const { data: quoteData, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        quote_number: quoteNumber,
        client_id: clientIdToUse,
        date_issued: new Date().toISOString().slice(0, 10),
        vat_rate: vatRate,
        deposit_percent: depositPercent,
        shipping_cost_incl_vat: shippingCostInclVat,
        notes: notes || null,
        status: "Draft",
      })
      .select()
      .single();

    if (quoteError) {
      setMessage(quoteError.message);
      return;
    }

    const itemsToInsert = quoteItems.map((item) => ({
      quote_id: quoteData.id,
      inventory_item_id: item.inventory_item_id || null,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      cost_price: item.cost_price,
      sale_price_incl_vat: item.sale_price_incl_vat,
    }));

    const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

    if (itemsError) {
      setMessage(itemsError.message);
      return;
    }

    const { error: settingsError } = await supabase
      .from("company_settings")
      .update({ next_quote_number: companySettings!.next_quote_number + 1 })
      .eq("id", companySettings!.id);

    if (settingsError) {
      setMessage(settingsError.message);
      return;
    }

    setMessage(`Quote saved: ${quoteNumber}`);
    clearEditor();
    await loadQuotes();
    await loadCompanySettings();
  }

  async function convertQuoteToInvoice(quote: SavedQuote) {
    if (!companySettings) {
      setMessage("Company settings not loaded.");
      return;
    }

    setMessage(`Converting ${quote.quote_number} to invoice...`);

    const { data: quoteItemRows, error: quoteItemsError } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id);

    if (quoteItemsError) {
      setMessage(quoteItemsError.message);
      return;
    }

    if (!quoteItemRows || quoteItemRows.length === 0) {
      setMessage("This quote has no items.");
      return;
    }

    const invoiceNumber = buildInvoiceNumber(
      companySettings.invoice_prefix,
      companySettings.next_invoice_number
    );

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        quote_id: quote.id,
        client_id: quote.client_id,
        date_issued: new Date().toISOString().slice(0, 10),
        vat_rate: quote.vat_rate,
        deposit_percent: quote.deposit_percent,
        shipping_cost_incl_vat: quote.shipping_cost_incl_vat || 0,
        notes: quote.notes,
        status: "Unpaid",
      })
      .select()
      .single();

    if (invoiceError) {
      setMessage(invoiceError.message);
      return;
    }

    const invoiceItemsToInsert = (quoteItemRows as QuoteItemRow[]).map((item) => ({
      invoice_id: invoiceData.id,
      inventory_item_id: item.inventory_item_id,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      cost_price: item.cost_price,
      sale_price_incl_vat: item.sale_price_incl_vat,
    }));

    const { error: invoiceItemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItemsToInsert);

    if (invoiceItemsError) {
      setMessage(invoiceItemsError.message);
      return;
    }

    const { error: settingsError } = await supabase
      .from("company_settings")
      .update({ next_invoice_number: companySettings.next_invoice_number + 1 })
      .eq("id", companySettings.id);

    if (settingsError) {
      setMessage(settingsError.message);
      return;
    }

    const { error: quoteUpdateError } = await supabase
      .from("quotes")
      .update({ status: "Converted" })
      .eq("id", quote.id);

    if (quoteUpdateError) {
      setMessage(quoteUpdateError.message);
      return;
    }

    setMessage(`Invoice created: ${invoiceNumber}`);
    await loadQuotes();
    await loadCompanySettings();
  }

  function getClientName(clientId: string | null) {
    if (!clientId) return "";
    const client = clients.find((c) => c.id === clientId);
    return client?.company_name || client?.private_name || "Unknown client";
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/">← Back to dashboard</Link>
      </div>

      <h1>Quotes</h1>

      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <p>
          Next quote number:{" "}
          <strong>
            {companySettings
              ? buildQuoteNumber(companySettings.quote_prefix, companySettings.next_quote_number)
              : "Loading..."}
          </strong>
        </p>
      </div>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 20 }}>
        <h2>{editingQuoteId ? "Edit Quote" : "Quote Details"}</h2>

        <div style={{ display: "grid", gap: 12 }}>
       <div>
            <label>Client</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setShowNewClientForm(false);
              }}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.private_name || "Unnamed client"}
                </option>
              ))}
            </select>
          
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedClientId("");
                  setShowNewClientForm((prev) => !prev);
                }}
                style={{ padding: "8px 12px" }}
              >
                {showNewClientForm ? "Use Existing Client Instead" : "Create New Client"}
              </button>
            </div>
          </div>
          
          {showNewClientForm ? (
            <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
              <h3 style={{ margin: "0 0 12px 0" }}>New Client</h3>
          
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label>Private Name</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientPrivateName}
                    onChange={(e) => setNewClientPrivateName(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>Company Name</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientCompanyName}
                    onChange={(e) => setNewClientCompanyName(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>Contact Person</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientContactPerson}
                    onChange={(e) => setNewClientContactPerson(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>Email</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>Phone</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>Address</label>
                  <textarea
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                  />
                </div>
          
                <div>
                  <label>VAT Number</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4 }}
                    value={newClientVatNumber}
                    onChange={(e) => setNewClientVatNumber(e.target.value)}
                  />
                </div>
          
                <label>
                  <input
                    type="checkbox"
                    checked={newClientIsBusiness}
                    onChange={(e) => setNewClientIsBusiness(e.target.checked)}
                  />{" "}
                  Business client
                </label>
              </div>
            </section>
          ) : null}

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

        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <label>Inventory Item</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={selectedInventoryId}
              onChange={(e) => setSelectedInventoryId(e.target.value)}
            >
              <option value="">Select an item</option>
              {inventory.map((item) => (
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
          {quoteItems.length === 0 ? (
            <p>No items added yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>SKU</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Qty</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Sale incl. VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {quoteItems.map((item, index) => (
                  <tr key={`${item.inventory_item_id}-${index}`}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{item.sku}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{item.name}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateQty(index, Number(e.target.value || 1))}
                        style={{ width: 80, padding: 6 }}
                      />
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{item.sale_price_incl_vat}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <button onClick={() => removeItem(index)}>Remove</button>
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
            gap: 10,
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
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>Subtotal</span>
            <strong>{totals.subtotal.toFixed(2)}</strong>
          </div>
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>VAT on sales</span>
            <strong>{totals.vatAmount.toFixed(2)}</strong>
          </div>
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>Shipping incl. VAT</span>
            <strong>{Number(shippingCostInclVat || 0).toFixed(2)}</strong>
          </div>
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>VAT on shipping</span>
            <strong>{totals.shippingVatAmount.toFixed(2)}</strong>
          </div>
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>Total incl. VAT</span>
            <strong>{totals.grossTotal.toFixed(2)}</strong>
          </div>
      
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#6b7280" }}>Deposit amount</span>
            <strong>{totals.depositAmount.toFixed(2)}</strong>
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
              marginTop: 6,
              paddingTop: 12,
              borderTop: "1px solid #d1d5db",
              fontSize: 18,
            }}
          >
            <span style={{ fontWeight: 700 }}>Internal profit</span>
            <strong>{totals.profit.toFixed(2)}</strong>
          </div>
        </div>
      
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button onClick={saveQuote} style={{ padding: "10px 14px" }}>
            {editingQuoteId ? "Update Quote" : "Save Quote"}
          </button>
          {editingQuoteId ? (
            <button onClick={clearEditor} style={{ padding: "10px 14px" }}>
              Cancel Editing
            </button>
          ) : null}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h2>Saved Quotes</h2>

        {savedQuotes.length === 0 ? (
          <p>No quotes saved yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Quote Number</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Client</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Date</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>View</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Edit</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {savedQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{quote.quote_number}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{getClientName(quote.client_id)}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{quote.date_issued}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{quote.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <Link href={`/quotes/${quote.id}`}>View</Link>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button onClick={() => startEditingQuote(quote)} style={{ padding: "6px 10px" }}>
                      Edit
                    </button>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button
                      onClick={() => convertQuoteToInvoice(quote)}
                      disabled={quote.status === "Converted"}
                      style={{ padding: "6px 10px" }}
                    >
                      {quote.status === "Converted" ? "Already Converted" : "Convert to Invoice"}
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