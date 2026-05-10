"use client";

import { AlertTriangle } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-level error boundary. Fires only when something in
 * app/layout.tsx itself crashes — by definition we can't rely on
 * any provider (theme, toast, fonts) being mounted, so the markup
 * is stand-alone and inlines its own minimal styling. Replaces
 * Next's white-screen default.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#fff",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <AlertTriangle width={32} height={32} style={{ color: "#dc2626", margin: "0 auto" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "1rem 0 0.5rem" }}>
            Application failed to load
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
            {error.message || "The app crashed before rendering. Refreshing the page may recover."}
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
