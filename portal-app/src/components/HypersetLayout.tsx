"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
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
  readOnlyEmails: string[];
  createdBy: string;
}

interface HypersetLayoutProps {
  pagesUrl: string;
  isAdmin: boolean;
  userEmail: string;
  canAccessAdmin: boolean;
  initialProjectId?: string;
}

export function HypersetLayout({ pagesUrl, isAdmin, userEmail, canAccessAdmin, initialProjectId }: HypersetLayoutProps) {
  const [allPages, setAllPages] = useState<PageApiItem[]>([]);
  const [projects, setProjects] = useState<ProjectApiItem[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  // Once mounted, keep content alive for smooth close animation
  const [adminMounted, setAdminMounted] = useState(false);
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
      // Keep current project if it still exists; otherwise fall back to initialProjectId, then first
      setSelectedProjectId((prev) => {
        if (prev !== null && projectItems.some((p) => p.id === prev)) return prev;
        if (initialProjectId && projectItems.some((p) => p.id === initialProjectId)) return initialProjectId;
        return projectItems[0]?.id ?? null;
      });
    } catch {
      // Portal API unavailable — not a fatal error
    }
  }, [initialProjectId]);

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

  // ── Apply initialProjectId — runs on mount and on client-side navigation ──────
  // Using a separate effect ensures this overrides the loadData fallback even when
  // the component instance is reused across Next.js client-side route transitions.
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

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
  // pagesRef keeps the latest pages list without being a useCallback dependency,
  // so navigateByKey (and both listeners below) are created exactly once.
  const pagesRef = useRef<Page[]>([]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  const navigateByKey = useCallback((key: string) => {
    const ps = pagesRef.current;
    if (key === "ArrowRight" || key === "ArrowDown") {
      setSelectedPage((current) => {
        if (ps.length === 0) return null;
        if (!current) return ps[0];
        const idx = ps.findIndex((p) => p.name === current.name);
        return idx < ps.length - 1 ? ps[idx + 1] : current;
      });
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      setSelectedPage((current) => {
        if (ps.length === 0) return null;
        if (!current) return ps[0];
        const idx = ps.findIndex((p) => p.name === current.name);
        return idx > 0 ? ps[idx - 1] : current;
      });
    }
  }, []); // stable — reads pages via ref

  const adminOpenRef = useRef(adminOpen);
  useEffect(() => { adminOpenRef.current = adminOpen; }, [adminOpen]);
  useEffect(() => { if (adminOpen) setAdminMounted(true); }, [adminOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (adminOpenRef.current) return;
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
  }, [navigateByKey]);

  // Arrow keys relayed from inside the iframe via postMessage
  // (type "hyperset-keydown" injected by the Pages Service).
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || e.data.type !== "hyperset-keydown") return;
      if (adminOpenRef.current) return;
      navigateByKey(e.data.key as string);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigateByKey]);

  // Focus sentinel: window.blur fires when a cross-origin iframe claims keyboard
  // focus (focusin on the iframe element is not reliable cross-browser).  We wait
  // one tick then redirect to a hidden sentinel div so the keydown handler above
  // keeps receiving arrow keys.  pointer-events:none leaves mouse interaction intact.
  const focusSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onWindowBlur = () => {
      if (!document.querySelector("iframe")) return; // no iframes → tab switch or address bar
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") {
          focusSentinelRef.current?.focus({ preventScroll: true });
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
    const project = projects.find((p) => p.id === id);
    if (project) {
      const slug = encodeURIComponent(project.name);
      window.history.replaceState(null, "", `/${slug}`);
    }
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
        adminOpen={adminOpen}
        canAccessAdmin={canAccessAdmin}
        onOpenAdmin={() => setAdminOpen((v) => !v)}
        onDisconnect={() => { window.location.href = "/api/auth/logout"; }}
      />

      {/* Settings panel — slides in/out inline, no overlay */}
      <div
        style={{
          ...(isPortraitMode
            ? { height: adminOpen ? "55vh" : 0, width: "100%", transition: "height 0.25s ease", borderTop: adminOpen ? "1px solid var(--md-outline-var)" : "none" }
            : { width: adminOpen ? 400 : 0, height: "100%", transition: "width 0.25s ease", borderLeft: adminOpen ? "1px solid var(--md-outline-var)" : "none" }
          ),
          overflow: "hidden",
          flexShrink: 0,
          order: 98,
        }}
      >
        <div style={isPortraitMode ? { height: "55vh", width: "100%" } : { width: 400, height: "100%" }}>
          {adminMounted && (
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
      </div>

      {/* Focus sentinel — invisible, zero-size, pointer-events:none.
          When a cross-origin iframe steals keyboard focus, the focusin listener
          above immediately redirects focus here so the parent window's keydown
          handler (arrow-key page navigation) keeps working.
          Mouse interaction with the iframe is unaffected because the sentinel
          is pointer-events:none and has no visual size.                       */}
      <div
        ref={focusSentinelRef}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "fixed", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
