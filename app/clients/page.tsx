"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  const [privateName, setPrivateName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [isBusinessClient, setIsBusinessClient] = useState(false);

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
    if (user) loadClients();
  }, [user]);

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
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/">← Back to dashboard</Link>
      </div>

      <h1>Clients</h1>

      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <p>
          Logged in as: <strong>{user?.email}</strong>
        </p>
        <button onClick={signOut} style={{ padding: "10px 14px" }}>
          Log Out
        </button>
      </div>

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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Private Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Company</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Contact</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Action</th>
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
                    <button onClick={() => startEditing(client)} style={{ padding: "6px 10px" }}>
                      Edit
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