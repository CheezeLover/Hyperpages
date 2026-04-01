"use client";

import React, { useState, useEffect, useCallback } from "react";

const spinKeyframes = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export interface AdminModalProps {
  onClose: () => void;
  userEmail: string;
  isAdmin: boolean;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  /** Projects already fetched by the parent layout — no extra request needed. */
  projects: ProjectInfo[];
  /** Called when a page's HTML/backend file is successfully replaced, so the
   *  parent can force the iframe to reload instead of showing the cached version. */
  onPageFilesChanged?: () => void;
}

interface PageInfo {
  name: string;
  hasBackend: boolean;
  active?: boolean;
  projectId?: string;
  order?: number;
  icon?: string;
  iconColor?: string;
  createdBy?: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
  allowedEmails: string[];
  createdBy: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <style>{spinKeyframes}</style>
      <div style={{ width: 24, height: 24, border: "3px solid var(--md-outline)", borderTopColor: "var(--md-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(211,47,47,0.1)", border: "1px solid rgba(211,47,47,0.3)", color: "#ef5350", fontSize: 13 }}>
      {msg}
    </div>
  );
}

// ── Page Edit Modal ────────────────────────────────────────────────────────────
function PageEditModal({
  page, projects, userEmail, isAdmin, onClose, onSaved, onFilesReplaced,
}: {
  page: PageInfo;
  projects: ProjectInfo[];
  userEmail: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  onFilesReplaced?: () => void;
}) {
  const [editIcon, setEditIcon] = useState(page.icon || "");
  const [editIconColor, setEditIconColor] = useState(page.iconColor || "");
  const [editProjectId, setEditProjectId] = useState<string>(page.projectId ?? "");
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editBackendFile, setEditBackendFile] = useState<File | null>(null);
  const [removeBackend, setRemoveBackend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleProjects = isAdmin ? projects : projects.filter((p) => p.createdBy === userEmail);

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      // 1. Replace files if provided
      if (editHtmlFile || editBackendFile || removeBackend) {
        const formData = new FormData();
        formData.append("name", page.name);
        if (editHtmlFile) formData.append("html", editHtmlFile);
        if (editBackendFile) formData.append("backend", editBackendFile);
        if (removeBackend) formData.append("removeBackend", "true");
        const res = await fetch("/api/admin/pages", { method: "PUT", body: formData });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "File update failed");
        // Notify parent so it can reload the iframe instead of showing cached content
        onFilesReplaced?.();
      }
      // 2. Update settings
      const res = await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: page.name,
          icon: editIcon.trim() || undefined,
          iconColor: editIconColor.trim() || undefined,
          projectId: editProjectId || undefined,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--md-surface-cont)", borderRadius: 16, padding: 24, minWidth: 380, maxWidth: 500, width: "90%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", margin: "0 0 20px" }}>
          Edit: {page.name}
        </h3>
        {error && <div style={{ marginBottom: 12 }}><ErrorBanner msg={error} /></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Icon + color */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Icon (1–2 chars)</label>
              <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder={page.name.charAt(0).toUpperCase()} style={{ ...inputStyle, padding: "8px 12px" }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Icon Color</label>
              <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="#1a73e8" style={{ ...inputStyle, padding: "8px 12px" }} />
            </div>
          </div>

          {/* Move to another project */}
          {visibleProjects.length > 1 && (
            <div>
              <label style={labelStyle}>Project</label>
              <select
                value={editProjectId}
                onChange={(e) => setEditProjectId(e.target.value)}
                style={{ ...inputStyle, padding: "8px 12px" }}
              >
                {visibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon ? `${p.icon} ` : ""}{p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Files */}
          <div>
            <label style={labelStyle}>Replace HTML File</label>
            <input type="file" accept=".html" onChange={(e) => setEditHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
          </div>
          <div>
            <label style={labelStyle}>Replace Backend File</label>
            <input type="file" accept=".py" onChange={(e) => setEditBackendFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
            {page.hasBackend && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={removeBackend} onChange={(e) => setRemoveBackend(e.target.checked)} />
                <span style={{ fontSize: 11, color: "#ef5350" }}>Remove existing backend</span>
              </label>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1, padding: "10px 24px" }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload form (always tied to a specific project) ────────────────────────────
function UploadForm({
  projectId, onClose, onUploaded,
}: {
  projectId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconColor, setIconColor] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [backendFile, setBackendFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!name.trim() || !htmlFile) { setError("Page name and HTML file are required"); return; }
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("html", htmlFile);
      if (backendFile) formData.append("backend", backendFile);
      formData.append("projectId", projectId);
      if (icon.trim()) formData.append("icon", icon.trim());
      if (iconColor.trim()) formData.append("iconColor", iconColor.trim());
      const res = await fetch("/api/admin/pages", { method: "POST", body: formData });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Upload failed");
      onUploaded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 14, border: "1px solid var(--md-outline-var)", marginTop: 6 }}>
      {error && <div style={{ marginBottom: 10 }}><ErrorBanner msg={error} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={labelStyle}>Page Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., docs, dashboard" style={{ ...inputStyle, width: "100%" }} />
          <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "3px 0 0" }}>Letters, numbers, underscores, hyphens</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Icon (1–2 chars)</label>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} placeholder="📄" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Icon Color</label>
            <input type="text" value={iconColor} onChange={(e) => setIconColor(e.target.value)} placeholder="#1a73e8" style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>HTML File *</label>
          <input type="file" accept=".html" onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
        </div>
        <div>
          <label style={labelStyle}>Backend (optional Python)</label>
          <input type="file" accept=".py" onChange={(e) => setBackendFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleUpload} disabled={uploading} style={{ ...primaryBtnStyle, opacity: uploading ? 0.6 : 1, padding: "7px 18px", fontSize: 12 }}>{uploading ? "Uploading..." : "Upload"}</button>
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Projects + Pages Tab ───────────────────────────────────────────────────────
function ProjectsTab({ userEmail, isAdmin, onPageFilesChanged }: { userEmail: string; isAdmin: boolean; onPageFilesChanged?: () => void }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Project form state
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
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [deletingProjectLoading, setDeletingProjectLoading] = useState(false);

  // Page state
  const [editModalPage, setEditModalPage] = useState<PageInfo | null>(null);
  const [uploadForProject, setUploadForProject] = useState<string | null>(null);
  const [deletingPage, setDeletingPage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    try {
      const [pagesRes, projRes] = await Promise.all([
        fetch("/api/admin/pages", { credentials: "include" }),
        fetch("/api/admin/projects", { credentials: "include" }),
      ]);
      if (!pagesRes.ok || !projRes.ok) { if (!silent) setError("Failed to load data"); return; }
      const { pages: pageItems } = await pagesRes.json() as { pages: PageInfo[] };
      const { projects: projectItems } = await projRes.json() as { projects: ProjectInfo[] };
      setPages(pageItems);
      setProjects(projectItems);
      setError(""); // clear any stale error banner on successful refresh
    } catch {
      if (!silent) setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const canManagePage = (page: PageInfo): boolean => {
    if (isAdmin) return true;
    if (page.createdBy === userEmail) return true;
    if (page.projectId) {
      return projects.find((p) => p.id === page.projectId)?.createdBy === userEmail;
    }
    return false;
  };

  // ── Project handlers ─────────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newName.trim()) { setError("Project name is required"); return; }
    setCreating(true); setError("");
    try {
      const emails = newEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined, iconColor: newIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Create failed");
      setShowCreate(false); setNewName(""); setNewIcon(""); setNewIconColor(""); setNewEmails("");
      loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const openEditProject = (p: ProjectInfo) => {
    setEditingProject(p.id);
    setEditName(p.name); setEditIcon(p.icon || ""); setEditIconColor(p.iconColor || "");
    setEditEmails(p.allowedEmails.filter((e) => e !== p.createdBy).join(", "));
  };

  const handleSaveProject = async (id: string) => {
    setSavingProject(true); setError("");
    try {
      const emails = editEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), icon: editIcon.trim() || undefined, iconColor: editIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      setEditingProject(null); loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setDeletingProjectLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Delete failed");
      setDeletingProject(null); loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingProjectLoading(false);
    }
  };

  // ── Page handlers ────────────────────────────────────────────────────────────
  const handleToggleActive = async (pageName: string, active: boolean) => {
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pageName, active }),
      });
      if (!res.ok) { setError("Failed to update page"); return; }
      setPages((prev) => prev.map((p) => p.name === pageName ? { ...p, active } : p));
    } catch { setError("Failed to update page"); }
  };

  const handleMoveOrder = async (pageName: string, projectPages: PageInfo[], delta: number) => {
    const idx = projectPages.findIndex((p) => p.name === pageName);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= projectPages.length) return;

    const names = projectPages.map((p) => p.name);
    names.splice(idx, 1);
    names.splice(newIdx, 0, pageName);

    // Optimistic update — reflects change instantly in the UI
    setPages((prev) => prev.map((p) => {
      const order = names.indexOf(p.name);
      return order >= 0 ? { ...p, order } : p;
    }));

    try {
      // Single bulk PATCH instead of N individual requests
      const res = await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: names.map((name, i) => ({ name, order: i })) }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Reorder failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update order");
      // Revert to original order on failure
      setPages((prev) => prev.map((p) => {
        const original = projectPages.find((pp) => pp.name === p.name);
        return original !== undefined ? { ...p, order: original.order ?? 0 } : p;
      }));
    }
  };

  const handleDeletePage = async (name: string) => {
    try {
      const res = await fetch("/api/admin/pages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) { setError("Failed to delete page"); return; }
      setPages((prev) => prev.filter((p) => p.name !== name));
      setDeletingPage(null);
    } catch { setError("Failed to delete page"); }
  };

  if (loading) return <Spinner />;

  const canAddToProject = (project: ProjectInfo) =>
    isAdmin || project.createdBy === userEmail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <ErrorBanner msg={error} />}

      {/* Page edit modal */}
      {editModalPage && (
        <PageEditModal
          page={editModalPage}
          projects={projects}
          userEmail={userEmail}
          isAdmin={isAdmin}
          onClose={() => setEditModalPage(null)}
          onSaved={() => loadData(true)}
          onFilesReplaced={onPageFilesChanged}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>
          Projects ({projects.length})
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              Templates ▾
            </button>
            {showTemplates && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--md-surface)", border: "1px solid var(--md-outline-var)", borderRadius: 8, padding: 8, zIndex: 10, minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
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
          <button onClick={() => setShowCreate(!showCreate)} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 12 }}>
            + New Project
          </button>
        </div>
      </div>

      {/* Create project form */}
      {showCreate && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Project Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Analytics" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Icon (1–2 chars)</label>
                <input type="text" value={newIcon} onChange={(e) => setNewIcon(e.target.value.slice(0, 2))} placeholder="📊" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Icon Color</label>
                <input type="text" value={newIconColor} onChange={(e) => setNewIconColor(e.target.value)} placeholder="#1a73e8" style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Allowed Emails (comma-separated)</label>
              <textarea value={newEmails} onChange={(e) => setNewEmails(e.target.value)} placeholder="alice@example.com, bob@example.com" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "4px 0 0" }}>Your email is always included.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreateProject} disabled={creating} style={{ ...primaryBtnStyle, opacity: creating ? 0.6 : 1, padding: "8px 20px" }}>{creating ? "Creating..." : "Create"}</button>
              <button onClick={() => { setShowCreate(false); setError(""); }} style={ghostBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Projects list with nested pages */}
      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface)", opacity: 0.5 }}>
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map((project) => {
            const canManageProject = isAdmin || project.createdBy === userEmail;
            const projectPages = pages
              .filter((p) => p.projectId === project.id)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const showDivider = projectPages.length > 0 || canAddToProject(project);

            return (
              <div key={project.id} style={{ background: "var(--md-surface)", borderRadius: 12, border: "1px solid var(--md-outline-var)", overflow: "hidden" }}>

                {/* Project row */}
                {editingProject === project.id ? (
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
                      <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder="Icon" style={{ ...inputStyle, width: 60 }} />
                      <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="Color" style={{ ...inputStyle, width: 100 }} />
                    </div>
                    {project.createdBy && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: "rgba(var(--md-primary-rgb, 103,80,164),0.08)", border: "1px solid var(--md-outline-var)" }}>
                        <span style={{ fontSize: 11, color: "var(--md-primary)", fontWeight: 600 }}>🔒</span>
                        <span style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.8 }}>{project.createdBy}</span>
                        <span style={{ fontSize: 10, opacity: 0.5, color: "var(--md-on-surface)", marginLeft: 2 }}>(creator — protected)</span>
                      </div>
                    )}
                    <textarea value={editEmails} onChange={(e) => setEditEmails(e.target.value)} placeholder="email1@ex.com, email2@ex.com" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveProject(project.id)} disabled={savingProject} style={{ ...primaryBtnStyle, padding: "6px 16px", fontSize: 12, opacity: savingProject ? 0.6 : 1 }}>{savingProject ? "Saving…" : "Save"}</button>
                      <button onClick={() => setEditingProject(null)} disabled={savingProject} style={{ ...ghostBtnStyle, opacity: savingProject ? 0.5 : 1 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, borderBottom: showDivider ? "1px solid var(--md-outline-var)" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: project.iconColor || "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                      {project.icon || project.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{project.name}</div>
                      <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5 }}>
                        {projectPages.length} page{projectPages.length !== 1 ? "s" : ""}
                        {" · "}
                        {project.allowedEmails.length === 0 ? "creator only" : `${project.allowedEmails.length} email${project.allowedEmails.length !== 1 ? "s" : ""}`}
                        {project.createdBy === userEmail ? " · owner" : ""}
                      </div>
                    </div>
                    {canManageProject && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEditProject(project)} style={{ ...testBtnStyle, padding: "4px 10px", fontSize: 11 }}>Edit</button>
                        {deletingProject === project.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, color: "#ef5350" }}>Delete?</span>
                            <button onClick={() => handleDeleteProject(project.id)} disabled={deletingProjectLoading} style={{ ...dangerBtnStyle, padding: "4px 8px", opacity: deletingProjectLoading ? 0.6 : 1 }}>{deletingProjectLoading ? "…" : "Yes"}</button>
                            <button onClick={() => setDeletingProject(null)} disabled={deletingProjectLoading} style={{ ...ghostBtnStyle, padding: "4px 8px", opacity: deletingProjectLoading ? 0.5 : 1 }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingProject(project.id)} style={dangerBtnStyle}>Remove</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Pages nested under project */}
                {projectPages.map((page, idx) => {
                  const canEdit = canManagePage(page);
                  const isActive = page.active !== false;
                  const deleteKey = `${project.id}:${page.name}`;
                  return (
                    <div key={page.name} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 14px 8px 22px",
                      borderBottom: idx < projectPages.length - 1 || canAddToProject(project) ? "1px solid var(--md-outline-var)" : "none",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: page.iconColor || (isActive ? "var(--md-primary)" : "var(--md-surface-cont)"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: isActive ? "white" : "var(--md-on-surface)",
                        opacity: isActive ? 1 : 0.45,
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>
                        {page.icon || page.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--md-on-surface)", opacity: isActive ? 1 : 0.5 }}>
                        {page.name}
                        {page.hasBackend && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.4 }}>py</span>}
                      </span>
                      {canEdit && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <button
                              onClick={() => handleMoveOrder(page.name, projectPages, -1)}
                              disabled={idx === 0}
                              title="Move up"
                              style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.12 : 0.45, fontSize: 9, padding: "1px 5px", color: "var(--md-on-surface)", lineHeight: 1 }}
                            >▲</button>
                            <button
                              onClick={() => handleMoveOrder(page.name, projectPages, 1)}
                              disabled={idx === projectPages.length - 1}
                              title="Move down"
                              style={{ background: "none", border: "none", cursor: idx === projectPages.length - 1 ? "default" : "pointer", opacity: idx === projectPages.length - 1 ? 0.12 : 0.45, fontSize: 9, padding: "1px 5px", color: "var(--md-on-surface)", lineHeight: 1 }}
                            >▼</button>
                          </div>
                          <label title={isActive ? "Visible — click to hide" : "Hidden — click to show"} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => handleToggleActive(page.name, e.target.checked)}
                              style={{ width: 13, height: 13, cursor: "pointer" }}
                            />
                          </label>
                          <button onClick={() => setEditModalPage(page)} style={{ ...testBtnStyle, padding: "3px 9px", fontSize: 11 }}>Edit</button>
                          {deletingPage === deleteKey ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 11, color: "#ef5350" }}>Delete?</span>
                              <button onClick={() => handleDeletePage(page.name)} style={{ ...dangerBtnStyle, padding: "3px 6px", fontSize: 11 }}>Yes</button>
                              <button onClick={() => setDeletingPage(null)} style={{ ...ghostBtnStyle, padding: "3px 6px", fontSize: 11 }}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingPage(deleteKey)} style={{ ...dangerBtnStyle, padding: "3px 8px", fontSize: 11 }}>✕</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add page */}
                {canAddToProject(project) && editingProject !== project.id && (
                  <div style={{ padding: "6px 14px 8px 22px" }}>
                    {uploadForProject === project.id ? (
                      <UploadForm
                        projectId={project.id}
                        onClose={() => setUploadForProject(null)}
                        onUploaded={() => loadData(true)}
                      />
                    ) : (
                      <button
                        onClick={() => setUploadForProject(project.id)}
                        style={{ background: "none", border: "1px dashed var(--md-outline)", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "var(--md-on-surface)", opacity: 0.4, cursor: "pointer", width: "100%", textAlign: "center" }}
                      >
                        + Add page
                      </button>
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

// ── Main Admin Panel ───────────────────────────────────────────────────────────
export function AdminModal({ onClose, userEmail, isAdmin, selectedProjectId, onSelectProject, projects, onPageFilesChanged }: AdminModalProps) {

  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--md-surface-cont)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 10, borderBottom: "1px solid var(--md-outline-var)", background: "var(--md-surface-cont)", flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="white"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>Admin</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.5, fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: 6 }}>×</button>
        </div>

        {/* Active project selector */}
        {projects.length > 0 && (
          <div style={{ padding: "10px 24px", background: "var(--md-surface-cont)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--md-outline-var)", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.4, color: "var(--md-on-surface)", textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>Active project</span>
            {projects.map((p) => {
              const isActive = p.id === selectedProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  title={p.name}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: isActive ? 600 : 400,
                    border: isActive ? "2px solid var(--md-primary)" : "1px solid var(--md-outline-var)",
                    background: isActive ? "var(--md-primary-cont)" : "transparent",
                    color: isActive ? "var(--md-primary)" : "var(--md-on-surface)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{p.icon || p.name.charAt(0).toUpperCase()}</span>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <ProjectsTab userEmail={userEmail} isAdmin={isAdmin} onPageFilesChanged={onPageFilesChanged} />
        </div>
      </div>
    </>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  background: "var(--md-surface-cont)", border: "1px solid var(--md-outline)", borderRadius: 10,
  padding: "10px 14px", fontSize: 13, color: "var(--md-on-surface)", outline: "none", width: "100%",
  transition: "all 0.2s ease", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
};
const primaryBtnStyle: React.CSSProperties = {
  background: "var(--md-primary)", color: "white", border: "none", borderRadius: 10,
  padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
};
const dangerBtnStyle: React.CSSProperties = {
  background: "rgba(211,47,47,0.08)", color: "#ef5350", border: "1px solid rgba(211,47,47,0.2)",
  borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", transition: "all 0.2s ease",
};
const testBtnStyle: React.CSSProperties = {
  background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)",
  borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  transition: "all 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const ghostBtnStyle: React.CSSProperties = {
  background: "none", color: "var(--md-on-surface)", border: "none", borderRadius: 8,
  padding: "8px 12px", fontSize: 12, cursor: "pointer", opacity: 0.6, transition: "opacity 0.2s ease",
};
