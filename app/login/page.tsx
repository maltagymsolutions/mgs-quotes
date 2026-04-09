"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f6f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.05)",
        }}
      >
       <div style={{ marginBottom: 20 }}>
          <Image
            src="/mgs-logo.svg"
            alt="Malta Gym Solutions"
            width={240}
            height={84}
            priority
            style={{ width: "240px", height: "auto", display: "block" }}
          />
        </div>

        <h1 style={{ margin: "0 0 10px 0" }}>Sign in</h1>
        <p style={{ margin: "0 0 20px 0", color: "#6b7280" }}>
          Log in to access the quotes and invoices dashboard.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label>Email</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label>Password</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button onClick={handleLogin} style={{ padding: "10px 14px" }}>
            Sign In
          </button>
        </div>

        {message ? (
          <div
            style={{
              marginTop: 16,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              color: "#374151",
            }}
          >
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}