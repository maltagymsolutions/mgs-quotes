"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage } from "@/src/components/app-page";
import { INVENTORY_CATEGORIES } from "@/src/lib/inventory-categories";
import {
  normalizePackageContents,
  packageContentsToText,
  parsePackageContentsText,
} from "@/src/lib/package-contents";
import { createClient } from "@/src/lib/supabase-browser";

type UserInfo = {
  email?: string;
} | null;

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  cost_price: number;
  sale_price_incl_vat: number;
  package_contents?: string[] | null;
};

type CsvRow = {
  sku: string;
  name: string;
  category: string;
  cost_price: number;
  sale_price_incl_vat: number;
  package_contents: string[];
};

const VAT_RATE = 18;

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function calculateMarginAfterVat(salePriceInclVat: number, costPrice: number) {
  const salePriceExclVat = salePriceInclVat / (1 + VAT_RATE / 100);
  return Math.round((salePriceExclVat - costPrice) * 100) / 100;
}

export default function InventoryPage() {
  const supabase = createClient();

  const [user, setUser] = useState<UserInfo>(null);
  const [message, setMessage] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [itemName, setItemName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePriceInclVat, setSalePriceInclVat] = useState("");
  const [packageContentsText, setPackageContentsText] = useState("");
  const [csvText, setCsvText] = useState(
    "sku,name,category,cost_price,sale_price_incl_vat,package_contents\nFIT-001,Fitness Bench,Benches,100,150,\nPKG-001,Home Gym Package,Strength,500,899,Bench|Barbell|80 kg plate set"
  );
  const [category, setCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name-asc");

  const loadInventory = useCallback(async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInventory(data || []);
  }, [supabase]);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ? { email: data.user.email } : null);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const timer = window.setTimeout(() => {
      loadInventory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadInventory, user]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Logged out.");
    setInventory([]);
  }

  async function addInventoryItem() {
    setMessage("Saving inventory item...");

    const { error } = await supabase.from("inventory_items").insert({
      sku,
      name: itemName,
      category: category || null,
      cost_price: Number(costPrice || 0),
      sale_price_incl_vat: Number(salePriceInclVat || 0),
      package_contents: parsePackageContentsText(packageContentsText),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    clearForm();
    setMessage("Inventory item saved.");
    loadInventory();
  }

  function startEditing(item: InventoryItem) {
    setEditingItemId(item.id);
    setCategory(item.category || "");
    setSku(item.sku || "");
    setItemName(item.name || "");
    setCostPrice(String(item.cost_price ?? ""));
    setSalePriceInclVat(String(item.sale_price_incl_vat ?? ""));
    setPackageContentsText(packageContentsToText(item.package_contents));
  }

  function clearForm() {
    setEditingItemId(null);
    setCategory("");
    setSku("");
    setItemName("");
    setCostPrice("");
    setSalePriceInclVat("");
    setPackageContentsText("");
  }

  async function updateInventoryItem() {
    if (!editingItemId) return;

    setMessage("Updating inventory item...");

    const { error } = await supabase
      .from("inventory_items")
    .update({
        sku,
        name: itemName,
        category: category || null,
        cost_price: Number(costPrice || 0),
        sale_price_incl_vat: Number(salePriceInclVat || 0),
        package_contents: parsePackageContentsText(packageContentsText),
      })
      .eq("id", editingItemId);

    if (error) {
      setMessage(error.message);
      return;
    }

    clearForm();
    setMessage("Inventory item updated.");
    loadInventory();
  }

  function parseCsv(text: string): CsvRow[] {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

     return {
        sku: row.sku || "",
        name: row.name || "",
        category: row.category || "",
        cost_price: Number(row.cost_price || 0),
        sale_price_incl_vat: Number(row.sale_price_incl_vat || 0),
        package_contents: (row.package_contents || "")
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
  }
  
  async function deleteInventoryItem(itemId: string) {
    const confirmed = window.confirm("Delete this inventory item?");
    if (!confirmed) return;
  
    setMessage("Deleting inventory item...");
  
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId);
  
    if (error) {
      setMessage(error.message);
      return;
    }
  
    if (editingItemId === itemId) {
      clearForm();
    }
  
    setMessage("Inventory item deleted.");
    loadInventory();
  }

  async function importCsv() {
    const rows = parseCsv(csvText).filter((row) => row.sku && row.name);
  
    if (rows.length === 0) {
      setMessage("No valid CSV rows found.");
      return;
    }
  
    setMessage("Importing inventory...");
  
    const rowsToInsert = rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category || null,
      cost_price: row.cost_price,
      sale_price_incl_vat: row.sale_price_incl_vat,
      package_contents: row.package_contents,
    }));
  
    const { error } = await supabase.from("inventory_items").insert(rowsToInsert);
  
    if (error) {
      setMessage(error.message);
      return;
    }
  
    setMessage(`Imported ${rows.length} inventory item(s).`);
    loadInventory();
  }

  const inventoryCount = useMemo(() => inventory.length, [inventory]);
  
  const filteredInventory = useMemo(() => {
    let items = [...inventory];
  
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.category || "").toLowerCase().includes(q) ||
          normalizePackageContents(item.package_contents).some((content) =>
            content.toLowerCase().includes(q)
          )
      );
    }
  
    if (categoryFilter !== "All") {
      items = items.filter((item) => (item.category || "Other") === categoryFilter);
    }
  
    if (sortBy === "name-asc") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      items.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "sku-asc") {
      items.sort((a, b) => a.sku.localeCompare(b.sku));
    } else if (sortBy === "price-low") {
      items.sort((a, b) => a.sale_price_incl_vat - b.sale_price_incl_vat);
    } else if (sortBy === "price-high") {
      items.sort((a, b) => b.sale_price_incl_vat - a.sale_price_incl_vat);
    }
  
    return items;
  }, [inventory, searchTerm, categoryFilter, sortBy]);

  return (
    <AppPage
      title="Inventory"
      description="Manage equipment SKUs, package contents, categories, costs, sale prices, margin, and CSV imports."
      actions={
        <div className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200">
          <span className="mr-3">{user?.email || "-"}</span>
          <button onClick={signOut} className="!rounded-md !border-white/20 !bg-transparent px-3 py-1.5 text-sm font-bold !text-white">
            Log out
          </button>
        </div>
      }
    >

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <section style={{ padding: 20, borderRadius: 16 }}>
          <h2 style={{ marginBottom: 18 }}>{editingItemId ? "Edit Inventory Item" : "Add Inventory Item"}</h2>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label>SKU</label>
                <input
                  style={{ width: "100%", padding: 12, marginTop: 6 }}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>

              <div>
                <label>Name</label>
                <input
                  style={{ width: "100%", padding: 12, marginTop: 6 }}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label>Category</label>
              <select
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select a category</option>
                {INVENTORY_CATEGORIES.map((inventoryCategory) => (
                  <option key={inventoryCategory} value={inventoryCategory}>
                    {inventoryCategory}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label>Cost Price</label>
                <input
                  style={{ width: "100%", padding: 12, marginTop: 6 }}
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>

              <div>
                <label>Sale Price incl. VAT</label>
                <input
                  style={{ width: "100%", padding: 12, marginTop: 6 }}
                  type="number"
                  value={salePriceInclVat}
                  onChange={(e) => setSalePriceInclVat(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label>Package Contents (optional)</label>
              <textarea
                value={packageContentsText}
                onChange={(e) => setPackageContentsText(e.target.value)}
                placeholder={"One included item per line\nExample: Adjustable bench\n20 kg barbell\n80 kg plate set"}
                style={{ width: "100%", minHeight: 112, padding: 12, marginTop: 6 }}
              />
              <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 13 }}>
                These items appear beneath the package name on quotes and invoices.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              {editingItemId ? (
                <>
                  <button onClick={updateInventoryItem} style={{ padding: "10px 14px" }}>
                    Update Inventory Item
                  </button>
                  <button
                    onClick={clearForm}
                    style={{
                      padding: "10px 14px",
                      background: "#ffffff",
                      color: "#111827",
                      border: "1px solid #d1d5db",
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={addInventoryItem} style={{ padding: "10px 14px" }}>
                  Save Inventory Item
                </button>
              )}
            </div>
          </div>
        </section>

        <section style={{ padding: 20, borderRadius: 16 }}>
          <h2 style={{ marginBottom: 12 }}>Import Inventory via CSV</h2>
      <p style={{ marginTop: 0, color: "#4b5563" }}>
            Use columns: <code>sku,name,category,cost_price,sale_price_incl_vat,package_contents</code>.
            Separate package contents with <code>|</code>.
          </p>
          <textarea
            style={{ width: "100%", minHeight: 220, padding: 12, marginTop: 4, fontFamily: "monospace" }}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={importCsv} style={{ padding: "10px 14px" }}>
              Import CSV
            </button>
            <span style={{ color: "#6b7280" }}>Example rows can be edited before import.</span>
          </div>
        </section>
      </div>

      <section style={{ padding: 20, borderRadius: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Inventory List</h2>
            <p style={{ margin: 0, color: "#6b7280" }}>{inventoryCount} item(s)</p>
          </div>
        </div>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        
          <div>
            <label>Category</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All categories</option>
              {INVENTORY_CATEGORIES.map((inventoryCategory) => (
                <option key={inventoryCategory} value={inventoryCategory}>
                  {inventoryCategory}
                </option>
              ))}
            </select>
          </div>
        
          <div>
            <label>Sort</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="sku-asc">SKU A-Z</option>
              <option value="price-low">Price low to high</option>
              <option value="price-high">Price high to low</option>
            </select>
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d1d5db",
              borderRadius: 12,
              padding: 24,
              color: "#6b7280",
            }}
          >
            No inventory items yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
 				<th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>SKU</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Category</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Cost</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Sale incl. VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Margin after VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Edit</th>
<th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const margin = calculateMarginAfterVat(
                    Number(item.sale_price_incl_vat || 0),
                    Number(item.cost_price || 0)
                  );

                  return (
                    <tr key={item.id}>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, fontWeight: 700 }}>{item.sku}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        <strong>{item.name}</strong>
                        {normalizePackageContents(item.package_contents).length > 0 ? (
                          <div style={{ marginTop: 6, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                            <span style={{ display: "block", fontWeight: 700 }}>
                              Package includes:
                            </span>
                            {normalizePackageContents(item.package_contents).map((content, index) => (
                              <span key={`${content}-${index}`} style={{ display: "block" }}>
                                - {content}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{item.category || "-"}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{money(item.cost_price)}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{money(item.sale_price_incl_vat)}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, fontWeight: 700 }}>{money(margin)}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
  <button
    onClick={() => startEditing(item)}
    style={{
      padding: "8px 12px",
      background: "#ffffff",
      color: "#111827",
      border: "1px solid #d1d5db",
    }}
  >
    Edit
  </button>
</td>
<td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
  <button
    onClick={() => deleteInventoryItem(item.id)}
    style={{
      padding: "8px 12px",
      background: "#ffffff",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    }}
  >
    Delete
  </button>
</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {message ? (
        <div
          style={{
            marginTop: 16,
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {message}
        </div>
      ) : null}
    </AppPage>
  );
}
