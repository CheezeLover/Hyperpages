"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ServiceColumn } from "./ServiceColumn";
import { AdminModal } from "./AdminModal";

interface Page {
  name: string;
  icon?: string;
  iconColor?: string;
}

interface HypersetLayoutProps {
  pagesUrl: string;
  isAdmin: boolean;
  userRoles: string[];
}

export function HypersetLayout({ pagesUrl, isAdmin, userRoles }: HypersetLayoutProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  // ── Dynamic pages discovery ──────────────────────────────────
  const loadPages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pages", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { pages: { name: string; active: boolean; allowedGroups: string[]; icon?: string; iconColor?: string }[] };

      const filteredPages: Page[] = data.pages
        .filter((p) => {
          if (!p.active) return false;
          if (p.allowedGroups.length === 0) return true;
          return p.allowedGroups.some((g) => userRoles.includes(g));
        })
        .map((p) => ({ name: p.name, icon: p.icon, iconColor: p.iconColor }));

      setPages((prev) => {
        if (
          prev.length === filteredPages.length &&
          prev.every((p, i) => p.name === filteredPages[i].name)
        ) return prev;
        setSelectedPage((sel) => {
          const stillExists = sel && filteredPages.some((p) => p.name === sel.name);
          return stillExists ? sel : (filteredPages[0] ?? null);
        });
        return filteredPages;
      });
    } catch {
      // Portal API unavailable — not a fatal error
    }
  }, [userRoles]);

  useEffect(() => {
    loadPages();
    const id = setInterval(loadPages, 10_000);
    return () => clearInterval(id);
  }, [loadPages]);

  useEffect(() => {
    const update = () => setIsPortraitMode(window.innerWidth < window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      id="hyperset-container"
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: isPortraitMode ? "column" : "row",
        background: "var(--md-surface)",
      }}
    >
      {/* Main panel — displays the selected page */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          background: "var(--md-surface-cont)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selectedPage ? (
          <iframe
            key={selectedPage.name}
            src={`${pagesUrl}/${selectedPage.name}`}
            title={selectedPage.name}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : (
          <div style={{ color: "var(--md-on-surface)", opacity: 0.4, fontSize: 14, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◻</div>
            No pages available
          </div>
        )}
      </div>

      {/* Service column */}
      <ServiceColumn
        isPortraitMode={isPortraitMode}
        pages={pages}
        selectedPage={selectedPage}
        isAdmin={isAdmin}
        onSelectPage={(page) => setSelectedPage(page)}
        onOpenAdmin={() => setAdminOpen(true)}
        onDisconnect={() => { window.location.href = "/api/auth/logout"; }}
      />

      {/* Admin modal */}
      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
