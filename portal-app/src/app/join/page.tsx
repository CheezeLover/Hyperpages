"use client";

import { useState, useEffect, useRef } from "react";

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
  rate_limited: {
    title: "Too many attempts",
    body: "Too many code attempts from your network. Please wait 15 minutes before trying again.",
  },
};

function GeometricMark() {
  return (
    <div style={{ position: "relative", width: 144, height: 144 }}>
      {/* Outer ring */}
      <div style={{
        position: "absolute", inset: 0,
        border: "1px solid rgba(255, 107, 53, 0.22)",
        borderRadius: "50%",
      }} />
      {/* Rotated square frame */}
      <div style={{
        position: "absolute", inset: 20,
        border: "1px solid rgba(255, 107, 53, 0.4)",
        transform: "rotate(45deg)",
      }} />
      {/* Filled diamond */}
      <div style={{
        position: "absolute", inset: 44,
        background: "#FF6B35",
        transform: "rotate(45deg)",
        opacity: 0.88,
      }} />
      {/* Center void */}
      <div style={{
        position: "absolute", inset: 63,
        background: "#0F0A07",
        borderRadius: "50%",
      }} />
      {/* Small orbit dot */}
      <div style={{
        position: "absolute",
        top: "50%",
        right: -4,
        width: 8,
        height: 8,
        marginTop: -4,
        background: "#FF6B35",
        borderRadius: "50%",
        opacity: 0.7,
      }} />
    </div>
  );
}

export default function JoinPage() {
  const [errorKey, setErrorKey] = useState<string>("");
  const [chars, setChars] = useState(["", "", "", "", ""]);
  const [isNarrow, setIsNarrow] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setErrorKey(params.get("error") ?? "");
  }, []);

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 660);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const message = MESSAGES[errorKey];
  const code = chars.join("");
  const isComplete = chars.every((c) => c !== "");

  const navigate = (finalCode: string) => {
    window.location.href = `/join/${finalCode}`;
  };

  const handleCharInput = (index: number, value: string) => {
    const char = value.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    const newChars = [...chars];
    newChars[index] = char;
    setChars(newChars);
    if (char) {
      if (index < 4) {
        inputRefs.current[index + 1]?.focus();
      } else if (newChars.every((c) => c !== "")) {
        setTimeout(() => navigate(newChars.join("")), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (chars[index]) {
        const newChars = [...chars];
        newChars[index] = "";
        setChars(newChars);
      } else if (index > 0) {
        const newChars = [...chars];
        newChars[index - 1] = "";
        setChars(newChars);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 4) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter" && isComplete) {
      navigate(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 5);
    const newChars = ["", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) newChars[i] = pasted[i];
    setChars(newChars);
    const focusIdx = Math.min(pasted.length, 4);
    setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
    if (pasted.length === 5) setTimeout(() => navigate(pasted), 100);
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: isNarrow ? "column" : "row",
      fontFamily: "'Syne', system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── LEFT: Brand panel ────────────────────────── */}
      <div style={{
        ...(isNarrow
          ? { width: "100%", height: 64, padding: "0 28px", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }
          : { width: "40%", minWidth: 300, padding: "52px 48px", flexDirection: "column", justifyContent: "space-between" }
        ),
        background: "#0F0A07",
        display: "flex",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Brand name */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#FF6B35",
        }}>
          Hyperset
        </div>

        {/* Center block (desktop only) */}
        {!isNarrow && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <GeometricMark />
            <div>
              <div style={{
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1.0,
                color: "#F5F0EC",
                letterSpacing: "-0.03em",
              }}>
                Hyper<br />pages
              </div>
              <div style={{
                marginTop: 14,
                fontSize: 13,
                color: "rgba(245,240,236,0.38)",
                lineHeight: 1.7,
                fontWeight: 400,
              }}>
                Collaborative page portal
              </div>
            </div>
          </div>
        )}

        {/* Footer (desktop only) */}
        {!isNarrow && (
          <div style={{
            fontSize: 11,
            color: "rgba(245,240,236,0.15)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            v2
          </div>
        )}

        {/* Decorative background circle (desktop) */}
        {!isNarrow && (
          <div style={{
            position: "absolute",
            bottom: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,107,53,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* ── RIGHT: Form panel ────────────────────────── */}
      <div style={{
        flex: 1,
        background: "var(--md-surface, #f5f3f0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isNarrow ? "36px 28px" : "52px 64px",
      }}>
        <div style={{ maxWidth: 360, width: "100%" }}>

          {message ? (
            /* ── Error state ── */
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
                fontSize: 20,
                color: "#ef4444",
              }}>
                ⚠
              </div>
              <h1 style={{
                fontSize: 24,
                fontWeight: 800,
                color: "var(--md-on-surface, #1c1b1f)",
                margin: "0 0 10px",
                letterSpacing: "-0.03em",
              }}>
                {message.title}
              </h1>
              <p style={{
                fontSize: 14,
                color: "var(--md-on-surface, #1c1b1f)",
                opacity: 0.5,
                lineHeight: 1.65,
                margin: "0 0 36px",
              }}>
                {message.body}
              </p>
              <button
                onClick={() => { window.location.href = "/join"; }}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--md-primary, #FF6B35)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Syne', system-ui, sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                Try again
              </button>
            </div>

          ) : (
            /* ── Access code form ── */
            <div>
              <h1 style={{
                fontSize: isNarrow ? 22 : 28,
                fontWeight: 800,
                color: "var(--md-on-surface, #1c1b1f)",
                margin: "0 0 6px",
                letterSpacing: "-0.03em",
              }}>
                Enter your code
              </h1>
              <p style={{
                fontSize: 13,
                color: "var(--md-on-surface, #1c1b1f)",
                opacity: 0.45,
                margin: "0 0 40px",
                lineHeight: 1.6,
              }}>
                5-character code to access a shared project
              </p>

              {/* 5-box code input */}
              <div
                style={{ display: "flex", gap: 10, marginBottom: 24, justifyContent: "center" }}
                onPaste={handlePaste}
              >
                {chars.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="text"
                    value={char}
                    onChange={(e) => handleCharInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={2}
                    autoFocus={i === 0}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    style={{
                      width: isNarrow ? 54 : 62,
                      height: isNarrow ? 66 : 76,
                      textAlign: "center",
                      fontSize: 28,
                      fontWeight: 700,
                      fontFamily: "'Syne Mono', monospace",
                      letterSpacing: "0.02em",
                      borderRadius: 12,
                      border: `2px solid ${char ? "var(--md-primary, #FF6B35)" : "var(--md-outline, #cac5be)"}`,
                      background: char ? "var(--md-primary-cont, #FFE5D9)" : "var(--md-surface-cont, #fff)",
                      color: char ? "var(--md-on-primary-cont, #E85A2D)" : "var(--md-on-surface, #1c1b1f)",
                      outline: "none",
                      transition: "border-color 0.15s, background 0.15s",
                      cursor: "text",
                      caretColor: "transparent",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => { if (isComplete) navigate(code); }}
                disabled={!isComplete}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  borderRadius: 12,
                  border: "none",
                  background: isComplete ? "var(--md-primary, #FF6B35)" : "var(--md-outline-var, #ddd8d2)",
                  color: isComplete ? "#fff" : "var(--md-on-surface, #1c1b1f)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isComplete ? "pointer" : "not-allowed",
                  fontFamily: "'Syne', system-ui, sans-serif",
                  letterSpacing: "0.04em",
                  transition: "background 0.2s, color 0.2s",
                  opacity: isComplete ? 1 : 0.5,
                }}
              >
                Access project →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
