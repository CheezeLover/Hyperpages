"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "Invalid code",
    body: "This access code is not valid. Please check the code and try again.",
  },
  expired: {
    title: "Code expired",
    body: "This access code has expired. Please ask the project owner to generate a new one.",
  },
  config: {
    title: "Configuration error",
    body: "The server is not configured to accept guest codes. Please contact the administrator.",
  },
};

function JoinContent() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error") ?? "";
  const message = MESSAGES[errorKey];

  const [inputCode, setInputCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length === 5) {
      window.location.href = `/join/${clean}`;
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--md-surface, #f5f5f5)",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "var(--md-surface-cont, #fff)",
        borderRadius: 16,
        padding: "40px 48px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {message ? "⚠️" : "🔑"}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "var(--md-on-surface, #1c1b1f)" }}>
          {message ? message.title : "Enter access code"}
        </h1>
        <p style={{ fontSize: 14, color: "var(--md-on-surface, #1c1b1f)", opacity: 0.6, margin: "0 0 28px" }}>
          {message ? message.body : "Enter the 5-character code you received to access a project."}
        </p>

        {!message && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="XXXXX"
              maxLength={5}
              autoFocus
              style={{
                fontSize: 28,
                letterSpacing: "0.4em",
                textAlign: "center",
                padding: "14px 12px",
                borderRadius: 10,
                border: "2px solid var(--md-outline, #ccc)",
                background: "var(--md-surface, #fff)",
                color: "var(--md-on-surface, #1c1b1f)",
                fontFamily: "monospace",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={inputCode.trim().length !== 5}
              style={{
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: "var(--md-primary, #6750a4)",
                color: "white",
                fontSize: 15,
                fontWeight: 600,
                cursor: inputCode.trim().length === 5 ? "pointer" : "not-allowed",
                opacity: inputCode.trim().length === 5 ? 1 : 0.5,
              }}
            >
              Access project
            </button>
          </form>
        )}

        {message && (
          <button
            onClick={() => window.location.href = "/join"}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "var(--md-primary, #6750a4)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  );
}
