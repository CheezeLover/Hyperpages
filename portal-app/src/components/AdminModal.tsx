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
  projectIds: string[];
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

// ── Project multi-select checkboxes ───────────────────────────────────────────
function ProjectCheckboxes({
  projects,
  selected,
  onChange,
  filterCreatedBy,
  isAdmin,
}: {
  projects: ProjectInfo[];
  selected: string[];
  onChange: (ids: string[]) => void;
  filterCreatedBy?: string;
  isAdmin: boolean;
}) {
  const visible = isAdmin ? projects : projects.filter((p) => p.createdBy === filterCreatedBy);
  if (visible.length === 0) return (
    <div style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", padding: "4px 0" }}>
      No projects available. Create one first.
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {visible.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--md-on-surface)" }}>
          <input
            type="checkbox"
            checked={selected.includes(p.id)}
            onChange={(e) => {
              if (e.target.checked) onChange([...selected, p.id]);
              else onChange(selected.filter((id) => id !== p.id));
            }}
            style={{ width: 15, height: 15, cursor: "pointer" }}
          />
          <span style={{ fontSize: 14 }}>{p.icon || p.name.charAt(0).toUpperCase()}</span>
          {p.name}
        </label>
      ))}
    </div>
  );
}

// ── Projects Management Component ─────────────────────────────────────────────
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
    setCreating(true); setError("");
    try {
      const emails = newEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined, iconColor: newIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Create failed");
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
    setEditName(p.name); setEditIcon(p.icon || ""); setEditIconColor(p.iconColor || "");
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
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      setEditingProject(null); loadProjects();
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
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Delete failed");
      setDeletingProject(null); loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{spinKeyframes}</style>
      {error && <ErrorBanner msg={error} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>Projects ({projects.length})</h3>
        <button onClick={() => setShowCreate(!showCreate)} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 12 }}>+ New Project</button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Project Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Analytics" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Icon (1-2 chars)</label>
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
              <button onClick={handleCreate} disabled={creating} style={{ ...primaryBtnStyle, opacity: creating ? 0.6 : 1, padding: "8px 20px" }}>{creating ? "Creating..." : "Create"}</button>
              <button onClick={() => { setShowCreate(false); setError(""); }} style={ghostBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface)", opacity: 0.5 }}>No projects yet. Create one to get started.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((project) => {
            const canManage = isAdmin || project.createdBy === userEmail;
            return (
              <div key={project.id} style={{ background: "var(--md-surface)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)" }}>
                {editingProject === project.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
                      <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder="Icon" style={{ ...inputStyle, width: 60 }} />
                      <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="Color" style={{ ...inputStyle, width: 100 }} />
                    </div>
                    <textarea value={editEmails} onChange={(e) => setEditEmails(e.target.value)} placeholder="email1@ex.com, email2@ex.com" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveEdit(project.id)} style={{ ...primaryBtnStyle, padding: "6px 16px", fontSize: 12 }}>Save</button>
                      <button onClick={() => setEditingProject(null)} style={ghostBtnStyle}>Cancel</button>
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
                        {project.allowedEmails.length === 0 ? "No access (creator only)" : `${project.allowedEmails.length} email${project.allowedEmails.length !== 1 ? "s" : ""}`}
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
                          <button onClick={() => setDeletingProject(project.id)} style={dangerBtnStyle}>Remove</button>
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
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageProjects, setNewPageProjects] = useState<string[]>([]);
  const [newPageIcon, setNewPageIcon] = useState("");
  const [newPageIconColor, setNewPageIconColor] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [backendFile, setBackendFile] = useState<File | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Per-row inline state
  const [editingProjectsFor, setEditingProjectsFor] = useState<string | null>(null);
  const [editPageProjects, setEditPageProjects] = useState<string[]>([]);
  const [deletingPage, setDeletingPage] = useState<string | null>(null);

  // File edit modal state
  const [editModalPage, setEditModalPage] = useState<PageInfo | null>(null);
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editBackendFile, setEditBackendFile] = useState<File | null>(null);
  const [removeBackend, setRemoveBackend] = useState(false);
  const [editIcon, setEditIcon] = useState("");
  const [editIconColor, setEditIconColor] = useState("");
  const [updatingPage, setUpdatingPage] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pagesRes, projRes] = await Promise.all([fetch("/api/admin/pages"), fetch("/api/admin/projects")]);
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
    return page.projectIds.some((pid) => projects.find((p) => p.id === pid)?.createdBy === userEmail);
  };

  // Pages shown based on project filter
  const visiblePages = filterProjectId === "__all__"
    ? [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [...pages].filter((p) => p.projectIds.includes(filterProjectId)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const handleUpload = async () => {
    if (!newPageName.trim() || !htmlFile) { setError("Page name and HTML file are required"); return; }
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("name", newPageName.trim());
      formData.append("html", htmlFile);
      if (backendFile) formData.append("backend", backendFile);
      formData.append("projectIds", JSON.stringify(newPageProjects));
      if (newPageIcon.trim()) formData.append("icon", newPageIcon.trim());
      if (newPageIconColor.trim()) formData.append("iconColor", newPageIconColor.trim());
      const res = await fetch("/api/admin/pages", { method: "POST", body: formData });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Upload failed");
      setShowUpload(false);
      setNewPageName(""); setNewPageProjects([]); setNewPageIcon(""); setNewPageIconColor("");
      setHtmlFile(null); setBackendFile(null);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (name: string, active: boolean) => {
    try {
      await fetch("/api/admin/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, active }) });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, active } : p));
    } catch { setError("Failed to update page"); }
  };

  const handleSaveProjects = async (name: string) => {
    try {
      await fetch("/api/admin/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, projectIds: editPageProjects }) });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, projectIds: editPageProjects } : p));
      setEditingProjectsFor(null);
    } catch { setError("Failed to update projects"); }
  };

  const handleMoveOrder = async (name: string, delta: number) => {
    const page = pages.find((p) => p.name === name);
    if (!page) return;
    const newOrder = (page.order ?? 0) + delta;
    try {
      await fetch("/api/admin/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, order: newOrder }) });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, order: newOrder } : p));
    } catch { setError("Failed to update order"); }
  };

  const handleDelete = async (name: string) => {
    try {
      await fetch("/api/admin/pages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setPages((prev) => prev.filter((p) => p.name !== name));
      setDeletingPage(null);
    } catch { setError("Failed to delete page"); }
  };

  const openEditModal = (page: PageInfo) => {
    setEditModalPage(page);
    setEditIcon(page.icon || ""); setEditIconColor(page.iconColor || "");
    setEditHtmlFile(null); setEditBackendFile(null); setRemoveBackend(false);
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
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      const icon = editIcon.trim() || undefined;
      const iconColor = editIconColor.trim() || undefined;
      await fetch("/api/admin/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editModalPage.name, icon, iconColor }) });
      setPages((prev) => prev.map((p) => p.name === editModalPage.name ? { ...p, icon, iconColor, hasBackend: !removeBackend && (!!editBackendFile || p.hasBackend) } : p));
      setEditModalPage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingPage(false);
    }
  };

  if (loading) return <Spinner />;

  const canAddPage = isAdmin || projects.some((p) => p.createdBy === userEmail);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{spinKeyframes}</style>
      {error && <ErrorBanner msg={error} />}

      {/* Toolbar: title + project filter + add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>Pages ({visiblePages.length})</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Project filter */}
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}
          >
            <option value="__all__">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* Templates */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowTemplates(!showTemplates)}
              style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Templates ▾
            </button>
            {showTemplates && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--md-surface)", border: "1px solid var(--md-outline-var)", borderRadius: 8, padding: 8, zIndex: 10, minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                <button onClick={() => { window.open("/page-templates/blank.html", "_blank"); setShowTemplates(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>blank.html</button>
                <button onClick={() => { window.open("/page-templates/backend.py", "_blank"); setShowTemplates(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>backend.py</button>
              </div>
            )}
          </div>
          {canAddPage && (
            <button onClick={() => setShowUpload(!showUpload)} style={{ ...primaryBtnStyle, padding: "6px 14px", fontSize: 12 }}>+ Add Page</button>
          )}
        </div>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Page Name *</label>
              <input type="text" value={newPageName} onChange={(e) => setNewPageName(e.target.value)} placeholder="e.g., docs, dashboard" style={{ ...inputStyle, width: "100%" }} />
              <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "4px 0 0" }}>Letters, numbers, underscores and hyphens only</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Icon (1-2 chars)</label>
                <input type="text" value={newPageIcon} onChange={(e) => setNewPageIcon(e.target.value.slice(0, 2))} placeholder="📄" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Icon Color</label>
                <input type="text" value={newPageIconColor} onChange={(e) => setNewPageIconColor(e.target.value)} placeholder="#1a73e8" style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Projects</label>
              <div style={{ background: "var(--md-surface-cont)", border: "1px solid var(--md-outline)", borderRadius: 10, padding: "10px 14px" }}>
                <ProjectCheckboxes
                  projects={projects}
                  selected={newPageProjects}
                  onChange={setNewPageProjects}
                  filterCreatedBy={userEmail}
                  isAdmin={isAdmin}
                />
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
              <button onClick={handleUpload} disabled={uploading} style={{ ...primaryBtnStyle, opacity: uploading ? 0.6 : 1, padding: "8px 20px" }}>{uploading ? "Uploading..." : "Upload"}</button>
              <button onClick={() => { setShowUpload(false); setError(""); }} style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Pages list */}
      {visiblePages.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface)", opacity: 0.5 }}>
          {filterProjectId === "__all__" ? "No pages available. Upload a page to get started." : "No pages in this project."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visiblePages.map((page, idx) => {
            const canEdit = canManagePage(page);
            const pageProjectNames = page.projectIds.map((pid) => projectMap.get(pid)?.name).filter(Boolean).join(", ");
            return (
              <div key={page.name} style={{ background: "var(--md-surface)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: page.iconColor || (page.active ? "var(--md-primary)" : "var(--md-surface-cont)"), display: "flex", alignItems: "center", justifyContent: "center", color: page.active ? "white" : "var(--md-on-surface)", opacity: page.active ? 1 : 0.4, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                    {page.icon || page.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)", opacity: page.active ? 1 : 0.5 }}>{page.name}</div>
                    <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {page.hasBackend ? "✓ backend" : "HTML only"}
                      {pageProjectNames ? ` • ${pageProjectNames}` : " • unassigned"}
                    </div>
                  </div>

                  {canEdit && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {/* Order controls */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <button onClick={() => handleMoveOrder(page.name, -1)} disabled={idx === 0} title="Move up"
                          style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.6, fontSize: 9, padding: "1px 4px", color: "var(--md-on-surface)" }}>▲</button>
                        <button onClick={() => handleMoveOrder(page.name, 1)} disabled={idx === visiblePages.length - 1} title="Move down"
                          style={{ background: "none", border: "none", cursor: idx === visiblePages.length - 1 ? "default" : "pointer", opacity: idx === visiblePages.length - 1 ? 0.2 : 0.6, fontSize: 9, padding: "1px 4px", color: "var(--md-on-surface)" }}>▼</button>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="checkbox" checked={page.active} onChange={(e) => handleToggleActive(page.name, e.target.checked)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                        <span style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.7 }}>Active</span>
                      </label>
                      <button onClick={() => { setEditingProjectsFor(page.name); setEditPageProjects([...page.projectIds]); }} style={{ ...ghostBtnStyle, padding: "4px 8px", fontSize: 11, opacity: 0.7 }}>Projects</button>
                      <button onClick={() => openEditModal(page)} style={{ ...testBtnStyle, padding: "4px 10px", fontSize: 11 }}>Edit</button>
                      {deletingPage === page.name ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 11, color: "#ef5350" }}>Delete?</span>
                          <button onClick={() => handleDelete(page.name)} style={{ ...dangerBtnStyle, padding: "4px 8px" }}>Yes</button>
                          <button onClick={() => setDeletingPage(null)} style={{ ...ghostBtnStyle, padding: "4px 8px" }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingPage(page.name)} style={dangerBtnStyle}>Remove</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline project assignment panel */}
                {editingProjectsFor === page.name && (
                  <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--md-surface-cont)", borderRadius: 8, border: "1px solid var(--md-outline-var)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)", marginBottom: 10 }}>Assign to projects:</div>
                    <ProjectCheckboxes
                      projects={projects}
                      selected={editPageProjects}
                      onChange={setEditPageProjects}
                      filterCreatedBy={userEmail}
                      isAdmin={isAdmin}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => handleSaveProjects(page.name)} style={{ ...primaryBtnStyle, padding: "6px 16px", fontSize: 12 }}>Save</button>
                      <button onClick={() => setEditingProjectsFor(null)} style={ghostBtnStyle}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File edit modal */}
      {editModalPage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditModalPage(null); }}>
          <div style={{ background: "var(--md-surface-cont)", borderRadius: 16, padding: 24, minWidth: 400, maxWidth: 500, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", margin: "0 0 20px" }}>Edit Page: {editModalPage.name}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Icon (1-2 chars)</label>
                  <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder={editModalPage.name.charAt(0).toUpperCase()} style={{ ...inputStyle, padding: "8px 12px" }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Icon Color</label>
                  <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="#1a73e8" style={{ ...inputStyle, padding: "8px 12px" }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>New HTML File (leave empty to keep existing)</label>
                <input type="file" accept=".html" onChange={(e) => setEditHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
              </div>
              <div>
                <label style={labelStyle}>New Backend File (leave empty to keep existing)</label>
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
              <button onClick={() => setEditModalPage(null)} style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpdateFiles} disabled={updatingPage} style={{ ...primaryBtnStyle, opacity: updatingPage ? 0.6 : 1, padding: "10px 24px" }}>{updatingPage ? "Updating..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
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
        <div style={{ background: "var(--md-surface-cont)", borderRadius: 20, padding: 0, minWidth: 380, maxWidth: 660, width: "94%", maxHeight: "85vh", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", gap: 14, borderBottom: "1px solid var(--md-outline-var)", background: "var(--md-surface-cont)", borderRadius: "20px 20px 0 0" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>Admin</div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.5 }}>Manage projects and pages</div>
            </div>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.5, fontSize: 20, lineHeight: 1, padding: "4px 8px", borderRadius: 8 }}>×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--md-outline-var)", background: "var(--md-surface-cont)" }}>
            {(["projects", "pages"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "12px 16px", background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid var(--md-primary)" : "2px solid transparent", color: activeTab === tab ? "var(--md-primary)" : "var(--md-on-surface)", fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer", opacity: activeTab === tab ? 1 : 0.6, transition: "all 0.15s", textTransform: "capitalize" }}>
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
