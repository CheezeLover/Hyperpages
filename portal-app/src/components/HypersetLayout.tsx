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
  const [pages, setPages] = useState<Page[]>([]);
  const [projects, setProjects] = useState<ProjectApiItem[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  // ── Dynamic data discovery ──────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [pagesRes, projRes] = await Promise.all([
        fetch("/api/admin/pages", { credentials: "include" }),
        fetch("/api/admin/projects", { credentials: "include" }),
      ]);
      if (!pagesRes.ok || !projRes.ok) return;
      const pagesData = await pagesRes.json() as { pages: PageApiItem[] };
      const projData = await projRes.json() as { projects: ProjectApiItem[] };

      setProjects(projData.projects);

      // Determine which project to show: keep current if still exists, else first
      setSelectedProjectId((prev) => {
        const stillExists = projData.projects.some((p) => p.id === prev);
        if (stillExists) return prev;
        return projData.projects[0]?.id ?? null;
      });

      setSelectedProjectId((currentProjectId) => {
        const projectId = currentProjectId ?? projData.projects[0]?.id ?? null;

        const filteredPages: Page[] = pagesData.pages
          .filter((p) =>
            projectId !== null &&
            p.projectId === projectId &&
            p.active !== false
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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

        return currentProjectId;
      });
    } catch {
      // Portal API unavailable — not a fatal error
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 10_000);
    return () => clearInterval(id);
  }, [loadData]);

  // Re-filter pages when project selection changes
  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

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
        />
      )}
    </div>
  );
}
