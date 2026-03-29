"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ServiceColumn } from "./ServiceColumn";
import { AdminModal } from "./AdminModal";

interface Page {
  name: string;
  icon?: string;
  iconColor?: string;
}

interface PageApiItem {
  name: string;
  active?: boolean;
  projectId?: string;
  order?: number;
  icon?: string;
  iconColor?: string;
}

interface ProjectApiItem {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
  allowedEmails: string[];
  createdBy: string;
}

interface HypersetLayoutProps {
  pagesUrl: string;
  isAdmin: boolean;
  userEmail: string;
}

export function HypersetLayout({ pagesUrl, isAdmin, userEmail }: HypersetLayoutProps) {
  const [allPages, setAllPages] = useState<PageApiItem[]>([]);
  const [projects, setProjects] = useState<ProjectApiItem[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isPortraitMode, setIsPortraitMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Bumped whenever a page's HTML file is replaced — forces the iframe to reload
  const [iframeKey, setIframeKey] = useState(0);

  // ── Fetch raw data; never derives display state (no double setState tricks) ──
  const loadData = useCallback(async () => {
    try {
      const [pagesRes, projRes] = await Promise.all([
        fetch("/api/admin/pages", { credentials: "include" }),
        fetch("/api/admin/projects", { credentials: "include" }),
      ]);
      if (!pagesRes.ok || !projRes.ok) return;
      const { pages: pageItems } = await pagesRes.json() as { pages: PageApiItem[] };
      const { projects: projectItems } = await projRes.json() as { projects: ProjectApiItem[] };
      setProjects(projectItems);
      setAllPages(pageItems);
      // Keep current project if it still exists; otherwise fall back to first
      setSelectedProjectId((prev) => {
        const stillExists = projectItems.some((p) => p.id === prev);
        return stillExists ? prev : (projectItems[0]?.id ?? null);
      });
    } catch {
      // Portal API unavailable — not a fatal error
    }
  }, []);

  // ── Derive visible sidebar pages whenever raw data or selection changes ───────
  // Pure local computation — no network call, no double-fetch on project switch.
  useEffect(() => {
    if (selectedProjectId === null) {
      setPages([]);
      setSelectedPage(null);
      return;
    }
    const filtered = allPages
      .filter((p) => p.projectId === selectedProjectId && p.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => ({ name: p.name, icon: p.icon, iconColor: p.iconColor }));

    // Avoid re-renders when the visible list hasn't changed
    setPages((prev) => {
      const unchanged =
        prev.length === filtered.length &&
        prev.every((p, i) => p.name === filtered[i].name);
      return unchanged ? prev : filtered;
    });
    // Keep selected page if it still exists in the new list
    setSelectedPage((sel) => {
      const stillExists = sel !== null && filtered.some((p) => p.name === sel.name);
      return stillExists ? sel : (filtered[0] ?? null);
    });
  }, [selectedProjectId, allPages]);

  // ── Polling — fetch raw data on mount, then every 10 s ───────────────────────
  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 10_000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const update = () => setIsPortraitMode(window.innerWidth < window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Keyboard navigation between pages ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept while the admin modal is open or while typing
      if (adminOpen) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedPage((current) => {
          if (pages.length === 0) return null;
          if (!current) return pages[0];
          const idx = pages.findIndex((p) => p.name === current.name);
          return idx < pages.length - 1 ? pages[idx + 1] : current;
        });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedPage((current) => {
          if (pages.length === 0) return null;
          if (!current) return pages[0];
          const idx = pages.findIndex((p) => p.name === current.name);
          return idx > 0 ? pages[idx - 1] : current;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pages, adminOpen]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSelectedPage(null);
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  // Server builds a single HTML file (pages inlined via srcdoc + base href).
  // Downloaded immediately — no print dialog, no external dependencies.
  const handleExportPdf = async () => {
    if (pages.length === 0 || !selectedProjectId || isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/export/html?projectId=${encodeURIComponent(selectedProjectId)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "export.html";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setIsExporting(false);
    }
  };

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
            key={`${selectedPage.name}-${iframeKey}`}
            src={`${pagesUrl}/${selectedPage.name}${iframeKey > 0 ? `?v=${iframeKey}` : ""}`}
            title={selectedPage.name}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : (
          <div style={{ color: "var(--md-on-surface)", opacity: 0.4, fontSize: 14, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◻</div>
            {projects.length === 0 ? "No projects available" : "No pages in this project"}
          </div>
        )}
      </div>

      {/* Service column */}
      <ServiceColumn
        isPortraitMode={isPortraitMode}
        pages={pages}
        selectedPage={selectedPage}
        onSelectPage={(page) => setSelectedPage(page)}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        onOpenAdmin={() => setAdminOpen(true)}
        onDisconnect={() => { window.location.href = "/api/auth/logout"; }}
      />

      {/* Admin modal */}
      {adminOpen && (
        <AdminModal
          onClose={() => { setAdminOpen(false); loadData(); }}
          userEmail={userEmail}
          isAdmin={isAdmin}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          projects={projects}
          onPageFilesChanged={() => setIframeKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
