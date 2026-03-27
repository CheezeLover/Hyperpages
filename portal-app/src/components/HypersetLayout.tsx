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

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSelectedPage(null);
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
            key={selectedPage.name}
            src={`${pagesUrl}/${selectedPage.name}`}
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
        />
      )}
    </div>
  );
}
