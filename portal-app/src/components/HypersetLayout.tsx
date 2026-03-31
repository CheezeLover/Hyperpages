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
  // Pages whose iframes have been mounted at least once — kept alive to avoid reload flash
  const [mountedPages, setMountedPages] = useState<Set<string>>(new Set());

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
      setMountedPages(new Set());
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
    // Evict mounted pages that are no longer in the current project
    setMountedPages((prev) => {
      const active = new Set(filtered.map((p) => p.name));
      const next = new Set([...prev].filter((n) => active.has(n)));
      return next.size === prev.size ? prev : next;
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
  // Shared handler used by both the direct keydown listener (window has focus)
  // and the postMessage listener (iframe has focus — relay injected by Pages Service).
  const navigateByKey = useCallback((key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") {
      setSelectedPage((current) => {
        if (pages.length === 0) return null;
        if (!current) return pages[0];
        const idx = pages.findIndex((p) => p.name === current.name);
        return idx < pages.length - 1 ? pages[idx + 1] : current;
      });
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      setSelectedPage((current) => {
        if (pages.length === 0) return null;
        if (!current) return pages[0];
        const idx = pages.findIndex((p) => p.name === current.name);
        return idx > 0 ? pages[idx - 1] : current;
      });
    }
  }, [pages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept while the admin modal is open or while typing
      if (adminOpen) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateByKey(e.key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateByKey, adminOpen]);

  // Arrow keys forwarded from inside the iframe via postMessage relay
  // (injected by the Pages Service into every served HTML page).
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || e.data.type !== "hyperset-keydown") return;
      if (adminOpen) return;
      navigateByKey(e.data.key as string);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigateByKey, adminOpen]);

  // Focus-sentinel: keep arrow-key page navigation working even after the user
  // clicks inside an iframe.
  //
  // Cross-origin iframes steal keyboard focus when clicked; parent window
  // keydown listeners stop firing.  "focusin" on the <iframe> element is NOT
  // reliable across browsers for cross-origin frames.  What IS reliable is
  // window.blur — it always fires when any child iframe captures focus.
  //
  // After blur we wait one tick (setTimeout 0) so document.activeElement has
  // settled, confirm it is an <iframe>, then redirect focus to an invisible
  // sentinel div in the parent document.  The sentinel has pointer-events:none
  // so all mouse events (clicks, scrolling) still reach the iframe normally.
  useEffect(() => {
    const onWindowBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") {
          (document.getElementById("hyperset-focus-sentinel") as HTMLElement | null)
            ?.focus({ preventScroll: true });
        }
      }, 0);
    };
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  }, []);

  // ── Track mounted iframes — add page on first selection ─────────────────────
  useEffect(() => {
    if (!selectedPage) return;
    setMountedPages((prev) => {
      if (prev.has(selectedPage.name)) return prev;
      return new Set([...prev, selectedPage.name]);
    });
  }, [selectedPage]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
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

  const panelBg = projects.find((p) => p.id === selectedProjectId)?.iconColor ?? "var(--md-surface-cont)";

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
          background: panelBg,
          position: "relative",
        }}
      >
        {/* Empty state — shown when no page is selected */}
        {!selectedPage && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--md-on-surface)", opacity: 0.4, fontSize: 14, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◻</div>
            {projects.length === 0 ? "No projects available" : "No pages in this project"}
          </div>
        )}
        {/* One iframe per page — mounted on first visit, shown/hidden thereafter.
            This eliminates the white flash when switching between already-loaded pages. */}
        {pages.map((page) => {
          if (!mountedPages.has(page.name)) return null;
          const isSelected = selectedPage?.name === page.name;
          return (
            <iframe
              key={`${page.name}-${iframeKey}`}
              src={`${pagesUrl}/${page.name}${iframeKey > 0 ? `?v=${iframeKey}` : ""}`}
              title={page.name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                display: isSelected ? "block" : "none",
              }}
            />
          );
        })}
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

      {/* Focus sentinel — invisible, zero-size, pointer-events:none.
          When a cross-origin iframe steals keyboard focus, the focusin listener
          above immediately redirects focus here so the parent window's keydown
          handler (arrow-key page navigation) keeps working.
          Mouse interaction with the iframe is unaffected because the sentinel
          is pointer-events:none and has no visual size.                       */}
      <div
        id="hyperset-focus-sentinel"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "fixed", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
