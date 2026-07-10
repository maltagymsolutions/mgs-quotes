"use client";

import { useCallback, useEffect, useState } from "react";
import { AppPage } from "@/src/components/app-page";
import { createClient } from "@/src/lib/supabase-browser";

type UserInfo = {
  email?: string;
} | null;

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

export default function ClientsPage() {
  const supabase = createClient();

  const [user, setUser] = useState<UserInfo>(null);
  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [privateName, setPrivateName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [isBusinessClient, setIsBusinessClient] = useState(false);

  const loadClients = useCallback(async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setClients(data || []);
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
      loadClients();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadClients, user]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Logged out.");
    setClients([]);
  }

  async function addClient() {
    setMessage("Saving client...");

    const { error } = await supabase.from("clients").insert({
      private_name: privateName || null,
      company_name: companyName || null,
      contact_person: contactPerson || null,
      email: clientEmail || null,
      phone: phone || null,
      address: address || null,
      vat_number: vatNumber || null,
      is_business_client: isBusinessClient,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    clearForm();
    setMessage("Client saved.");
    loadClients();
  }

  function startEditing(client: Client) {
    setSelectedClient(client);
    setEditingClientId(client.id);
    setPrivateName(client.private_name || "");
    setCompanyName(client.company_name || "");
    setContactPerson(client.contact_person || "");
    setClientEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setVatNumber(client.vat_number || "");
    setIsBusinessClient(client.is_business_client);
  }

  function viewClient(client: Client) {
    setSelectedClient(client);
  }

  function clearForm() {
    setEditingClientId(null);
    setPrivateName("");
    setCompanyName("");
    setContactPerson("");
    setClientEmail("");
    setPhone("");
    setAddress("");
    setVatNumber("");
    setIsBusinessClient(false);
  }

  async function updateClient() {
    if (!editingClientId) return;

    setMessage("Updating client...");

    const { error } = await supabase
      .from("clients")
      .update({
        private_name: privateName || null,
        company_name: companyName || null,
        contact_person: contactPerson || null,
        email: clientEmail || null,
        phone: phone || null,
        address: address || null,
        vat_number: vatNumber || null,
        is_business_client: isBusinessClient,
      })
      .eq("id", editingClientId);

    if (error) {
      setMessage(error.message);
      return;
    }

    clearForm();
    setMessage("Client updated.");
    loadClients();
  }

  return (
    <AppPage
      title="Clients"
      description="Manage private and business client records, contacts, VAT details, and addresses."
      maxWidthClass="max-w-6xl"
      actions={
        <div className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200">
          <span className="mr-3">{user?.email || "-"}</span>
          <button onClick={signOut} className="!rounded-md !border-white/20 !bg-transparent px-3 py-1.5 text-sm font-bold !text-white">
            Log out
          </button>
        </div>
      }
    >

      {selectedClient ? (
        <section style={{ border: "1px solid #cbd5e1", padding: 18, borderRadius: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>
                {selectedClient.company_name || selectedClient.private_name || "Client details"}
              </h2>
              <p style={{ margin: 0, color: "#64748b" }}>
                {selectedClient.is_business_client ? "Business client" : "Private client"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => startEditing(selectedClient)} style={{ padding: "8px 12px" }}>
                Edit
              </button>
              <button
                onClick={() => setSelectedClient(null)}
                style={{
                  padding: "8px 12px",
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                }}
              >
                Close
              </button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
              gap: 14,
              marginTop: 16,
            }}
          >
            <ClientDetail label="Private name" value={selectedClient.private_name} />
            <ClientDetail label="Company" value={selectedClient.company_name} />
            <ClientDetail label="Contact person" value={selectedClient.contact_person} />
            <ClientDetail label="Email" value={selectedClient.email} />
            <ClientDetail label="Phone" value={selectedClient.phone} />
            <ClientDetail label="VAT number" value={selectedClient.vat_number} />
            <div style={{ gridColumn: "1 / -1" }}>
              <ClientDetail label="Address" value={selectedClient.address} />
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <h2>{editingClientId ? "Edit Client" : "Add Client"}</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Private Name</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={privateName} onChange={(e) => setPrivateName(e.target.value)} />
          </div>

          <div>
            <label>Company Name</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>

          <div>
            <label>Contact Person</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>

          <div>
            <label>Email</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>

          <div>
            <label>Phone</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label>Address</label>
            <textarea style={{ width: "100%", padding: 10, marginTop: 4 }} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <label>VAT Number</label>
            <input style={{ width: "100%", padding: 10, marginTop: 4 }} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
          </div>

          <label>
            <input type="checkbox" checked={isBusinessClient} onChange={(e) => setIsBusinessClient(e.target.checked)} /> Business client
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            {editingClientId ? (
              <>
                <button onClick={updateClient} style={{ padding: "10px 14px" }}>
                  Update Client
                </button>
                <button onClick={clearForm} style={{ padding: "10px 14px" }}>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={addClient} style={{ padding: "10px 14px" }}>
                Save Client
              </button>
            )}
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}>
        <h2>Clients</h2>

        {clients.length === 0 ? (
          <p>No clients yet.</p>
        ) : (
          <div style={{ maxWidth: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Private Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Company</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Contact</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Type</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{client.private_name}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{client.company_name}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{client.contact_person}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{client.email}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {client.is_business_client ? "Business" : "Private"}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => viewClient(client)} style={{ padding: "6px 10px" }}>
                          View
                        </button>
                        <button
                          onClick={() => startEditing(client)}
                          style={{
                            padding: "6px 10px",
                            background: "#ffffff",
                            color: "#111827",
                            border: "1px solid #d1d5db",
                          }}
                        >
                          Edit
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

      {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
    </AppPage>
  );
}

function ClientDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>{label}</div>
      <strong style={{ whiteSpace: "pre-wrap" }}>{value || "-"}</strong>
    </div>
  );
}
