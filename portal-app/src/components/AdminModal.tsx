"use client";

import React, { useState, useEffect, useCallback } from "react";

const spinKeyframes = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export interface AdminModalProps {
  onClose: () => void;
  userEmail: string;
  isAdmin: boolean;
}

interface PageInfo {
  name: string;
  hasBackend: boolean;
  active: boolean;
  allowedEmails: string[];
  projectId?: string;
  order?: number;
  icon?: string;
  iconColor?: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
  allowedEmails: string[];
  createdBy: string;
}

// ── Projects Management Component ────────────────────────────────────────────
function ProjectsTab({ userEmail, isAdmin }: { userEmail: string; isAdmin: boolean }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newIconColor, setNewIconColor] = useState("");
  const [newEmails, setNewEmails] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editIconColor, setEditIconColor] = useState("");
  const [editEmails, setEditEmails] = useState("");
  const [deletingProject, setDeletingProject] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/projects");
      const data = await res.json() as { projects: ProjectInfo[] };
      setProjects(data.projects);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) { setError("Project name is required"); return; }
    setCreating(true);
    setError("");
    try {
      const emails = newEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined, iconColor: newIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Create failed");
      }
      setShowCreate(false);
      setNewName(""); setNewIcon(""); setNewIconColor(""); setNewEmails("");
      loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (p: ProjectInfo) => {
    setEditingProject(p.id);
    setEditName(p.name);
    setEditIcon(p.icon || "");
    setEditIconColor(p.iconColor || "");
    setEditEmails(p.allowedEmails.join(", "));
  };

  const handleSaveEdit = async (id: string) => {
    setError("");
    try {
      const emails = editEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), icon: editIcon.trim() || undefined, iconColor: editIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      setEditingProject(null);
      loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      const res = await fetch("/api/admin/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setDeletingProject(null);
      loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 24, height: 24, border: "3px solid var(--md-outline)", borderTopColor: "var(--md-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{spinKeyframes}</style>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(211,47,47,0.1)", border: "1px solid rgba(211,47,47,0.3)", color: "#ef5350", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>
          Projects ({projects.length})
        </h3>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ background: "var(--md-primary)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + New Project
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ ...labelStyle }}>Project Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Analytics, Operations" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle }}>Icon (1-2 chars)</label>
                <input type="text" value={newIcon} onChange={(e) => setNewIcon(e.target.value.slice(0, 2))}
                  placeholder="📊" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle }}>Icon Color (CSS)</label>
                <input type="text" value={newIconColor} onChange={(e) => setNewIconColor(e.target.value)}
                  placeholder="#1a73e8" style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle }}>Allowed Emails (comma-separated)</label>
              <textarea value={newEmails} onChange={(e) => setNewEmails(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                rows={2}
                style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
              <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "4px 0 0" }}>
                Your email is always included. Leave empty to restrict to yourself only.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={creating}
                style={{ ...primaryBtnStyle, opacity: creating ? 0.6 : 1, padding: "8px 20px" }}>
                {creating ? "Creating..." : "Create"}
              </button>
              <button onClick={() => { setShowCreate(false); setError(""); }}
                style={{ ...ghostBtnStyle }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface)", opacity: 0.5 }}>
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((project) => {
            const canManage = isAdmin || project.createdBy === userEmail;
            return (
              <div key={project.id}
                style={{ background: "var(--md-surface)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)" }}>
                {editingProject === project.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder="Project name" style={{ ...inputStyle, flex: 1 }} />
                      <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))}
                        placeholder="Icon" style={{ ...inputStyle, width: 60 }} />
                      <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)}
                        placeholder="Color" style={{ ...inputStyle, width: 80 }} />
                    </div>
                    <textarea value={editEmails} onChange={(e) => setEditEmails(e.target.value)}
                      placeholder="email1@ex.com, email2@ex.com" rows={2}
                      style={{ ...inputStyle, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveEdit(project.id)} style={{ ...primaryBtnStyle, padding: "6px 16px", fontSize: 12 }}>Save</button>
                      <button onClick={() => setEditingProject(null)} style={{ ...ghostBtnStyle }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: project.iconColor || "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                      {project.icon || project.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{project.name}</div>
                      <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5 }}>
                        {project.allowedEmails.length === 0
                          ? "No access (creator only)"
                          : `${project.allowedEmails.length} email${project.allowedEmails.length !== 1 ? "s" : ""}`}
                        {project.createdBy === userEmail ? " • owner" : ""}
                      </div>
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(project)} style={{ ...testBtnStyle, padding: "4px 10px", fontSize: 11 }}>Edit</button>
                        {deletingProject === project.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, color: "#ef5350" }}>Delete?</span>
                            <button onClick={() => handleDelete(project.id)} style={{ ...dangerBtnStyle, padding: "4px 8px" }}>Yes</button>
                            <button onClick={() => setDeletingProject(null)} style={{ ...ghostBtnStyle, padding: "4px 8px" }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingProject(project.id)} style={{ ...dangerBtnStyle }}>Remove</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pages Management Component ────────────────────────────────────────────────
function PagesTab({ userEmail, isAdmin }: { userEmail: string; isAdmin: boolean }) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageProject, setNewPageProject] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [backendFile, setBackendFile] = useState<File | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editEmails, setEditEmails] = useState("");
  const [deletingPage, setDeletingPage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editModalPage, setEditModalPage] = useState<PageInfo | null>(null);
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editBackendFile, setEditBackendFile] = useState<File | null>(null);
  const [removeBackend, setRemoveBackend] = useState(false);
  const [editIcon, setEditIcon] = useState("");
  const [editIconColor, setEditIconColor] = useState("");
  const [updatingPage, setUpdatingPage] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pagesRes, projRes] = await Promise.all([
        fetch("/api/admin/pages"),
        fetch("/api/admin/projects"),
      ]);
      const pagesData = await pagesRes.json() as { pages: PageInfo[] };
      const projData = await projRes.json() as { projects: ProjectInfo[] };
      setPages(pagesData.pages);
      setProjects(projData.projects);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const canManagePage = (page: PageInfo): boolean => {
    if (isAdmin) return true;
    if (!page.projectId) return false;
    const project = projects.find((p) => p.id === page.projectId);
    return project?.createdBy === userEmail;
  };

  const handleUpload = async () => {
    if (!newPageName.trim() || !htmlFile) {
      setError("Page name and HTML file are required");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", newPageName.trim());
      formData.append("html", htmlFile);
      if (backendFile) formData.append("backend", backendFile);
      if (newPageProject) formData.append("projectId", newPageProject);
      const res = await fetch("/api/admin/pages", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      setShowUpload(false);
      setNewPageName(""); setNewPageProject(""); setHtmlFile(null); setBackendFile(null);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (name: string, active: boolean) => {
    try {
      await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, active }),
      });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, active } : p));
    } catch {
      setError("Failed to update page");
    }
  };

  const handleSaveEmails = async (name: string) => {
    const emails = editEmails.split(",").map((e) => e.trim()).filter(Boolean);
    try {
      await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, allowedEmails: emails }),
      });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, allowedEmails: emails } : p));
      setEditingPage(null);
    } catch {
      setError("Failed to update emails");
    }
  };

  const handleMoveOrder = async (name: string, delta: number) => {
    const page = pages.find((p) => p.name === name);
    if (!page) return;
    const newOrder = (page.order ?? 0) + delta;
    try {
      await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, order: newOrder }),
      });
      setPages((prev) =>
        prev
          .map((p) => p.name === name ? { ...p, order: newOrder } : p)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
    } catch {
      setError("Failed to update order");
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await fetch("/api/admin/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setPages((prev) => prev.filter((p) => p.name !== name));
      setDeletingPage(null);
    } catch {
      setError("Failed to delete page");
    }
  };

  const openEditModal = (page: PageInfo) => {
    setEditModalPage(page);
    setEditIcon(page.icon || "");
    setEditIconColor(page.iconColor || "");
    setEditHtmlFile(null);
    setEditBackendFile(null);
    setRemoveBackend(false);
  };

  const handleUpdateFiles = async () => {
    if (!editModalPage) return;
    setUpdatingPage(true);
    try {
      const formData = new FormData();
      formData.append("name", editModalPage.name);
      if (editHtmlFile) formData.append("html", editHtmlFile);
      if (editBackendFile) formData.append("backend", editBackendFile);
      if (removeBackend) formData.append("removeBackend", "true");
      const res = await fetch("/api/admin/pages", { method: "PUT", body: formData });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      const icon = editIcon.trim() || undefined;
      const iconColor = editIconColor.trim() || undefined;
      await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editModalPage.name, icon, iconColor }),
      });
      setPages((prev) => prev.map((p) =>
        p.name === editModalPage.name
          ? { ...p, icon, iconColor, hasBackend: !removeBackend && (!!editBackendFile || p.hasBackend) }
          : p
      ));
      setEditModalPage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingPage(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 24, height: 24, border: "3px solid var(--md-outline)", borderTopColor: "var(--md-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Group pages by project
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const grouped: { projectId: string | undefined; projectName: string; pages: PageInfo[] }[] = [];
  const seen = new Set<string | undefined>();
  for (const page of [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const key = page.projectId;
    if (!seen.has(key)) {
      seen.add(key);
      grouped.push({
        projectId: key,
        projectName: key ? (projectMap.get(key)?.name ?? "Unknown Project") : "Unassigned",
        pages: [],
      });
    }
    grouped.find((g) => g.projectId === key)!.pages.push(page);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{spinKeyframes}</style>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(211,47,47,0.1)", border: "1px solid rgba(211,47,47,0.3)", color: "#ef5350", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>
          Pages ({pages.length})
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowTemplates(!showTemplates)}
              style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Templates ▾
            </button>
            {showTemplates && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--md-surface)", border: "1px solid var(--md-outline-var)", borderRadius: 8, padding: 8, zIndex: 10, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                <button onClick={() => { window.open("/page-templates/blank.html", "_blank"); setShowTemplates(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>
                  blank.html
                </button>
                <button onClick={() => { window.open("/page-templates/backend.py", "_blank"); setShowTemplates(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>
                  backend.py
                </button>
              </div>
            )}
          </div>
          {(isAdmin || projects.some((p) => p.createdBy === userEmail)) && (
            <button onClick={() => setShowUpload(!showUpload)}
              style={{ background: "var(--md-primary)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Add Page
            </button>
          )}
        </div>
      </div>

      {showUpload && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ ...labelStyle }}>Page Name</label>
              <input type="text" value={newPageName} onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., docs, help, dashboard" style={{ ...inputStyle, width: "100%" }} />
              <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "4px 0 0" }}>
                Only letters, numbers, underscores and hyphens
              </p>
            </div>
            <div>
              <label style={{ ...labelStyle }}>Project</label>
              <select value={newPageProject} onChange={(e) => setNewPageProject(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}>
                {isAdmin && <option value="">— Unassigned —</option>}
                {projects
                  .filter((p) => isAdmin || p.createdBy === userEmail)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle }}>HTML File *</label>
              <input type="file" accept=".html" onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
            </div>
            <div>
              <label style={{ ...labelStyle }}>Backend (optional Python)</label>
              <input type="file" accept=".py" onChange={(e) => setBackendFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleUpload} disabled={uploading}
                style={{ ...primaryBtnStyle, opacity: uploading ? 0.6 : 1, padding: "8px 20px" }}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button onClick={() => { setShowUpload(false); setError(""); }}
                style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pages.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface)", opacity: 0.5 }}>
          No pages available. Upload a page to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {grouped.map((group) => (
            <div key={group.projectId ?? "__unassigned__"}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--md-on-surface)", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, paddingLeft: 2 }}>
                {group.projectName}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.pages.map((page, idx) => {
                  const canEdit = canManagePage(page);
                  return (
                    <div key={page.name}
                      style={{ background: "var(--md-surface)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: page.iconColor || (page.active ? "var(--md-primary)" : "var(--md-surface-cont)"), display: "flex", alignItems: "center", justifyContent: "center", color: page.active ? "white" : "var(--md-on-surface)", opacity: page.active ? 1 : 0.4, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                        {page.icon || page.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)", opacity: page.active ? 1 : 0.5 }}>
                          {page.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5 }}>
                          {page.hasBackend ? "✓ Has backend" : "HTML only"}
                          {page.allowedEmails && page.allowedEmails.length > 0 ? ` • Emails: ${page.allowedEmails.join(", ")}` : ""}
                        </div>
                      </div>

                      {canEdit && editingPage === page.name ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="text" value={editEmails} onChange={(e) => setEditEmails(e.target.value)}
                            placeholder="email1, email2" style={{ ...inputStyle, width: 160, padding: "6px 10px", fontSize: 12 }} />
                          <button onClick={() => handleSaveEmails(page.name)} style={{ ...primaryBtnStyle, padding: "6px 12px", fontSize: 11 }}>Save</button>
                          <button onClick={() => setEditingPage(null)} style={{ ...ghostBtnStyle }}>×</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {canEdit && (
                            <>
                              {/* Order controls */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <button onClick={() => handleMoveOrder(page.name, -1)} disabled={idx === 0}
                                  title="Move up"
                                  style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.6, fontSize: 10, lineHeight: 1, padding: "2px 4px", color: "var(--md-on-surface)" }}>
                                  ▲
                                </button>
                                <button onClick={() => handleMoveOrder(page.name, 1)} disabled={idx === group.pages.length - 1}
                                  title="Move down"
                                  style={{ background: "none", border: "none", cursor: idx === group.pages.length - 1 ? "default" : "pointer", opacity: idx === group.pages.length - 1 ? 0.2 : 0.6, fontSize: 10, lineHeight: 1, padding: "2px 4px", color: "var(--md-on-surface)" }}>
                                  ▼
                                </button>
                              </div>
                              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                <input type="checkbox" checked={page.active} onChange={(e) => handleToggleActive(page.name, e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                                <span style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.7 }}>Active</span>
                              </label>
                              <button onClick={() => { setEditingPage(page.name); setEditEmails((page.allowedEmails ?? []).join(", ")); }}
                                style={{ ...ghostBtnStyle, opacity: 0.6 }}>Emails</button>
                              <button onClick={() => openEditModal(page)} style={{ ...testBtnStyle, padding: "4px 10px", fontSize: 11 }}>Edit</button>
                              {deletingPage === page.name ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 11, color: "#ef5350" }}>Delete?</span>
                                  <button onClick={() => handleDelete(page.name)} style={{ ...dangerBtnStyle, padding: "4px 8px" }}>Yes</button>
                                  <button onClick={() => setDeletingPage(null)} style={{ ...ghostBtnStyle, padding: "4px 8px" }}>No</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletingPage(page.name)} style={{ ...dangerBtnStyle }}>Remove</button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editModalPage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditModalPage(null); }}>
          <div style={{ background: "var(--md-surface-cont)", borderRadius: 16, padding: 24, minWidth: 400, maxWidth: 500, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", margin: "0 0 20px" }}>
              Edit Page: {editModalPage.name}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle }}>Icon (single character or emoji)</label>
                  <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))}
                    placeholder={editModalPage.name.charAt(0).toUpperCase()} style={{ ...inputStyle, width: "100%", padding: "8px 12px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle }}>Icon Color (CSS)</label>
                  <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)}
                    placeholder="#1a73e8" style={{ ...inputStyle, width: "100%", padding: "8px 12px" }} />
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle }}>New HTML File (leave empty to keep existing)</label>
                <input type="file" accept=".html" onChange={(e) => setEditHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
              </div>
              <div>
                <label style={{ ...labelStyle }}>New Backend File (leave empty to keep existing)</label>
                <input type="file" accept=".py" onChange={(e) => setEditBackendFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
                {editModalPage.hasBackend && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={removeBackend} onChange={(e) => setRemoveBackend(e.target.checked)} />
                    <span style={{ fontSize: 11, color: "#ef5350" }}>Remove existing backend</span>
                  </label>
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditModalPage(null)}
                style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleUpdateFiles} disabled={updatingPage}
                style={{ ...primaryBtnStyle, opacity: updatingPage ? 0.6 : 1, padding: "10px 24px" }}>
                {updatingPage ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Modal ───────────────────────────────────────────────────────────
export function AdminModal({ onClose, userEmail, isAdmin }: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<"projects" | "pages">("projects");

  return (
    <>
      <style>{spinKeyframes}</style>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: "var(--md-surface-cont)", borderRadius: 20, padding: 0, minWidth: 380, maxWidth: 640, width: "94%", maxHeight: "85vh", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", gap: 14, borderBottom: "1px solid var(--md-outline-var)", background: "var(--md-surface-cont)", borderRadius: "20px 20px 0 0" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="white">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>Admin</div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.5 }}>Manage projects and pages</div>
            </div>
            <button onClick={onClose}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.5, fontSize: 20, lineHeight: 1, padding: "4px 8px", borderRadius: 8 }}>
              ×
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--md-outline-var)", background: "var(--md-surface-cont)" }}>
            {(["projects", "pages"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--md-primary)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--md-primary)" : "var(--md-on-surface)",
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: "pointer",
                  opacity: activeTab === tab ? 1 : 0.6,
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {activeTab === "projects"
              ? <ProjectsTab userEmail={userEmail} isAdmin={isAdmin} />
              : <PagesTab userEmail={userEmail} isAdmin={isAdmin} />
            }
          </div>
        </div>
      </div>
    </>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7,
  color: "var(--md-on-surface)", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  background: "var(--md-surface-cont)", border: "1px solid var(--md-outline)",
  borderRadius: 10, padding: "10px 14px", fontSize: 13,
  color: "var(--md-on-surface)", outline: "none", width: "100%",
  transition: "all 0.2s ease", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--md-primary)", color: "white", border: "none", borderRadius: 10,
  padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
};

const dangerBtnStyle: React.CSSProperties = {
  background: "rgba(211,47,47,0.08)", color: "#ef5350", border: "1px solid rgba(211,47,47,0.2)", borderRadius: 8,
  padding: "6px 14px", fontSize: 12, cursor: "pointer", transition: "all 0.2s ease",
};

const testBtnStyle: React.CSSProperties = {
  background: "var(--md-surface-cont)", color: "var(--md-on-surface)",
  border: "1px solid var(--md-outline)", borderRadius: 10,
  padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: 1,
  transition: "all 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "none", color: "var(--md-on-surface)", border: "none", borderRadius: 8,
  padding: "8px 12px", fontSize: 12, cursor: "pointer", opacity: 0.6, transition: "opacity 0.2s ease",
};
