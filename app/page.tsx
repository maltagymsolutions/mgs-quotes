import Image from "next/image";
import Link from "next/link";

const cards = [
  {
    title: "Clients",
    description: "Add and manage private and business clients used on your documents.",
    href: "/clients",
    cta: "Open Clients",
  },
  {
    title: "Inventory",
    description: "Maintain your catalogue, pricing, and CSV imports for products and equipment.",
    href: "/inventory",
    cta: "Open Inventory",
  },
  {
    title: "Quotes",
    description: "Create quotes, track internal profit, and convert approved quotes into invoices.",
    href: "/quotes",
    cta: "Open Quotes",
  },
  {
    title: "Invoices",
    description: "Create and edit invoices while keeping internal margin details separate from the client view.",
    href: "/invoices",
    cta: "Open Invoices",
  },
];

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1180 }}>
      <section
        style={{
          padding: 36,
          borderRadius: 18,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          marginBottom: 24,
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.05)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px minmax(0, 1fr)",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div>
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions"
              width={150}
              height={80}
              priority
              style={{ width: "150px", height: "auto", display: "block" }}
            />
      
            <div
              style={{
                width: 56,
                height: 3,
                background: "#e10600",
                marginTop: 22,
                marginBottom: 18,
                borderRadius: 999,
              }}
            />
      
            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: 180,
              }}
            >
              Internal workspace for quotes, invoices, clients, and inventory.
            </p>
          </div>
      
          <div style={{ maxWidth: 720 }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              Admin Dashboard
            </p>
      
            <h1
              style={{
                margin: "0 0 14px 0",
                fontSize: "3.2rem",
                lineHeight: 0.98,
                color: "#111827",
                letterSpacing: "-0.04em",
              }}
            >
              Quote and Invoice Creator
            </h1>
      
            <p
              style={{
                margin: 0,
                color: "#4b5563",
                lineHeight: 1.65,
                fontSize: 17,
                maxWidth: 560,
              }}
            >
              Create quotes, manage inventory, and convert approved quotes into invoices.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Choose a section</h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Open the area you want to work on.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {cards.map((card) => (
            <div
              key={card.href}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 215,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#111827" }}>{card.title}</h3>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>{card.description}</p>
              </div>

              <div style={{ marginTop: 20 }}>
                <Link
                  href={card.href}
                  style={{
                    display: "inline-block",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {card.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}