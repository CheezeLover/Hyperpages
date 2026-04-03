"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Style constants ────────────────────────────────────────────────────────────
const label: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--md-on-surface)", opacity: 0.45, marginBottom: 6,
};
const input: React.CSSProperties = {
  width: "100%", background: "var(--md-surface)", border: "1px solid var(--md-outline-var)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--md-on-surface)",
  outline: "none", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  background: "var(--md-primary)", color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "none", color: "var(--md-on-surface)", border: "1px solid var(--md-outline-var)",
  borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  background: "none", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "var(--md-surface-cont)", color: "var(--md-on-surface)",
  border: "1px solid var(--md-outline-var)", borderRadius: 8,
  padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
const card: React.CSSProperties = {
  background: "var(--md-surface)", borderRadius: 12,
  border: "1px solid var(--md-outline-var)", overflow: "hidden",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--md-on-surface)", opacity: 0.4,
};

const spinKeyframes = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AdminModalProps {
  onClose: () => void;
  userEmail: string;
  isAdmin: boolean;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  projects: ProjectInfo[];
  onPageFilesChanged?: () => void;
}

interface PageInfo {
  name: string; hasBackend: boolean; active?: boolean;
  projectId?: string; order?: number; icon?: string; iconColor?: string; createdBy?: string;
}
interface ProjectInfo {
  id: string; name: string; icon?: string; iconColor?: string;
  allowedEmails: string[]; createdBy: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
      <style>{spinKeyframes}</style>
      <div style={{ width: 22, height: 22, border: "2px solid var(--md-outline-var)", borderTopColor: "var(--md-primary)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>
      {msg}
    </div>
  );
}

function Badge({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "primary" | "danger" }) {
  const colors = {
    default: { background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline-var)" },
    primary: { background: "rgba(var(--md-primary-rgb,103,80,164),0.1)", color: "var(--md-primary)", border: "1px solid rgba(var(--md-primary-rgb,103,80,164),0.2)" },
    danger:  { background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" },
  };
  return (
    <span style={{ ...colors[color], fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 20, display: "inline-flex", alignItems: "center" }}>
      {children}
    </span>
  );
}

// ── Inline Page Editor ─────────────────────────────────────────────────────────
function PageInlineEditor({ page, onClose, onSaved, onFilesReplaced }: {
  page: PageInfo; onClose: () => void; onSaved: () => void; onFilesReplaced?: () => void;
}) {
  const [editIcon, setEditIcon] = useState(page.icon || "");
  const [editIconColor, setEditIconColor] = useState(page.iconColor || "");
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editBackendFile, setEditBackendFile] = useState<File | null>(null);
  const [removeBackend, setRemoveBackend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      if (editHtmlFile || editBackendFile || removeBackend) {
        const formData = new FormData();
        formData.append("name", page.name);
        if (editHtmlFile) formData.append("html", editHtmlFile);
        if (editBackendFile) formData.append("backend", editBackendFile);
        if (removeBackend) formData.append("removeBackend", "true");
        const res = await fetch("/api/admin/pages", { method: "PUT", body: formData });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "File update failed");
        onFilesReplaced?.();
      }
      const res = await fetch("/api/admin/pages", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: page.name, icon: editIcon.trim() || undefined, iconColor: editIconColor.trim() || undefined }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      onSaved(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: "14px 20px 16px", background: "var(--md-surface-cont)", borderTop: "1px solid var(--md-outline-var)" }}>
      {error && <div style={{ marginBottom: 12 }}><ErrorBanner msg={error} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Icon</label>
            <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder={page.name.charAt(0).toUpperCase()} style={input} />
          </div>
          <div style={{ flex: 3 }}>
            <label style={label}>Icon Color</label>
            <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="#1a73e8" style={input} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={label}>Replace HTML</label>
            <input type="file" accept=".html" onChange={(e) => setEditHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)", maxWidth: "100%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={label}>Replace Backend</label>
            <input type="file" accept=".py" onChange={(e) => setEditBackendFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)", maxWidth: "100%" }} />
          </div>
        </div>
        {page.hasBackend && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={removeBackend} onChange={(e) => setRemoveBackend(e.target.checked)} style={{ accentColor: "#ef4444" }} />
            <span style={{ fontSize: 12, color: "#ef4444" }}>Remove existing backend</span>
          </label>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, padding: "7px 16px", fontSize: 12, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
          <button onClick={onClose} style={{ ...btnGhost, padding: "7px 12px", fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload form ────────────────────────────────────────────────────────────────
function UploadForm({ projectId, onClose, onUploaded }: { projectId: string; onClose: () => void; onUploaded: () => void }) {
  const [name, setName] = useState(""); const [icon, setIcon] = useState(""); const [iconColor, setIconColor] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null); const [backendFile, setBackendFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false); const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!name.trim() || !htmlFile) { setError("Page name and HTML file are required"); return; }
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim()); formData.append("html", htmlFile);
      if (backendFile) formData.append("backend", backendFile);
      formData.append("projectId", projectId);
      if (icon.trim()) formData.append("icon", icon.trim());
      if (iconColor.trim()) formData.append("iconColor", iconColor.trim());
      const res = await fetch("/api/admin/pages", { method: "POST", body: formData });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Upload failed");
      onUploaded(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div style={{ background: "var(--md-surface-cont)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)", marginTop: 8 }}>
      {error && <div style={{ marginBottom: 10 }}><ErrorBanner msg={error} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={label}>Page Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., docs" style={input} />
          <p style={{ fontSize: 11, opacity: 0.45, color: "var(--md-on-surface)", margin: "4px 0 0" }}>Letters, numbers, hyphens, underscores</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Icon</label>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} placeholder="📄" style={input} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={label}>Color</label>
            <input type="text" value={iconColor} onChange={(e) => setIconColor(e.target.value)} placeholder="#1a73e8" style={input} />
          </div>
        </div>
        <div>
          <label style={label}>HTML File *</label>
          <input type="file" accept=".html" onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
        </div>
        <div>
          <label style={label}>Backend (optional Python)</label>
          <input type="file" accept=".py" onChange={(e) => setBackendFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleUpload} disabled={uploading} style={{ ...btnPrimary, padding: "8px 16px", fontSize: 12, opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading…" : "Upload"}</button>
          <button onClick={onClose} style={{ ...btnGhost, padding: "8px 14px", fontSize: 12 }}>Cancel</button>
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

  type CodeRecord = { id: string; createdBy: string; createdAt: string; expiresAt: string };
  const [codes, setCodes] = useState<Record<string, CodeRecord[]>>({});
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<{ projectId: string; code: string } | null>(null);
  const [copiedType, setCopiedType] = useState<"code" | "url" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const [editingPage, setEditingPage] = useState<string | null>(null); // page name
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
      setPages(pageItems); setProjects(projectItems); setError("");
    } catch { if (!silent) setError("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const canManagePage = (page: PageInfo): boolean => {
    if (isAdmin) return true;
    if (page.createdBy === userEmail) return true;
    if (page.projectId) return projects.find((p) => p.id === page.projectId)?.createdBy === userEmail;
    return false;
  };

  // ── Project handlers ─────────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newName.trim()) { setError("Project name is required"); return; }
    setCreating(true); setError("");
    try {
      const emails = newEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined, iconColor: newIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Create failed");
      setShowCreate(false); setNewName(""); setNewIcon(""); setNewIconColor(""); setNewEmails("");
      loadData(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Create failed"); }
    finally { setCreating(false); }
  };

  const openEditProject = (p: ProjectInfo) => {
    setEditingProject(p.id);
    setEditName(p.name); setEditIcon(p.icon || ""); setEditIconColor(p.iconColor || "");
    setEditEmails(p.allowedEmails.filter((e) => e !== p.createdBy).join(", "));
    setNewCode(null); setCopiedType(null);
    fetch(`/api/admin/codes?projectId=${p.id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { codes: [] })
      .then((data: { codes: CodeRecord[] }) => setCodes((prev) => ({ ...prev, [p.id]: data.codes })))
      .catch(() => {});
  };

  const handleGenerateCode = async (projectId: string) => {
    setGeneratingCode(projectId); setNewCode(null); setCopiedType(null);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { code: string; id: string; createdAt: string; expiresAt: string };
      setNewCode({ projectId, code: data.code });
      setCodes((prev) => ({
        ...prev,
        [projectId]: [{ id: data.id, createdBy: userEmail, createdAt: data.createdAt, expiresAt: data.expiresAt }, ...(prev[projectId] ?? [])],
      }));
    } catch { setError("Failed to generate code"); }
    finally { setGeneratingCode(null); }
  };

  const handleDeleteCode = async (codeId: string, projectId: string) => {
    setDeletingCode(codeId);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: codeId }),
      });
      if (!res.ok) throw new Error("Failed");
      setCodes((prev) => ({ ...prev, [projectId]: (prev[projectId] ?? []).filter((c) => c.id !== codeId) }));
      if (newCode?.projectId === projectId) setNewCode(null);
    } catch { setError("Failed to revoke code"); }
    finally { setDeletingCode(null); }
  };

  const handleCopy = (text: string, type: "code" | "url") => {
    navigator.clipboard.writeText(text).then(() => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      setCopiedType(type);
      copyTimeoutRef.current = setTimeout(() => setCopiedType(null), 2000);
    });
  };
  useEffect(() => () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); }, []);

  const handleSaveProject = async (id: string) => {
    setSavingProject(true); setError("");
    try {
      const emails = editEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const res = await fetch("/api/admin/projects", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), icon: editIcon.trim() || undefined, iconColor: editIconColor.trim() || undefined, allowedEmails: emails }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Update failed");
      setEditingProject(null); loadData(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
    finally { setSavingProject(false); }
  };

  const handleDeleteProject = async (id: string) => {
    setDeletingProjectLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/projects", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Delete failed");
      setDeletingProject(null); loadData(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeletingProjectLoading(false); }
  };

  // ── Page handlers ────────────────────────────────────────────────────────────
  const handleToggleActive = async (pageName: string, active: boolean) => {
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pageName, active }),
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
    names.splice(idx, 1); names.splice(newIdx, 0, pageName);
    setPages((prev) => prev.map((p) => { const order = names.indexOf(p.name); return order >= 0 ? { ...p, order } : p; }));
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: names.map((name, i) => ({ name, order: i })) }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Reorder failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update order");
      setPages((prev) => prev.map((p) => { const original = projectPages.find((pp) => pp.name === p.name); return original !== undefined ? { ...p, order: original.order ?? 0 } : p; }));
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
  const canAddToProject = (project: ProjectInfo) => isAdmin || project.createdBy === userEmail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <ErrorBanner msg={error} />}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--md-on-surface)" }}>Projects</div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.45, marginTop: 1 }}>{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Templates dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowTemplates(!showTemplates)} style={btnGhost}>
              Templates <span style={{ opacity: 0.5, marginLeft: 2 }}>▾</span>
            </button>
            {showTemplates && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--md-surface)", border: "1px solid var(--md-outline-var)", borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                {[["blank.html", "/page-templates/blank.html"], ["backend.py", "/page-templates/backend.py"]].map(([name, url]) => (
                  <button key={name} onClick={() => { window.open(url, "_blank"); setShowTemplates(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 7, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12, fontFamily: "monospace" }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>+ New Project</button>
        </div>
      </div>

      {/* Create project form */}
      {showCreate && (
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)", marginBottom: 16 }}>New project</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Analytics" style={input} autoFocus />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Icon</label>
                <input type="text" value={newIcon} onChange={(e) => setNewIcon(e.target.value.slice(0, 2))} placeholder="📊" style={input} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={label}>Icon Color</label>
                <input type="text" value={newIconColor} onChange={(e) => setNewIconColor(e.target.value)} placeholder="#1a73e8" style={input} />
              </div>
            </div>
            <div>
              <label style={label}>Edit Access — Emails</label>
              <textarea value={newEmails} onChange={(e) => setNewEmails(e.target.value)} placeholder="alice@example.com, bob@example.com" rows={2} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
              <p style={{ fontSize: 11, opacity: 0.4, color: "var(--md-on-surface)", margin: "5px 0 0" }}>Your email is always included.</p>
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button onClick={handleCreateProject} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>{creating ? "Creating…" : "Create"}</button>
              <button onClick={() => { setShowCreate(false); setError(""); }} style={btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Projects list */}
      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--md-on-surface)", opacity: 0.4, fontSize: 13 }}>
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map((project) => {
            const canManageProject = isAdmin || project.createdBy === userEmail;
            const projectPages = pages.filter((p) => p.projectId === project.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            return (
              <div key={project.id} style={card}>

                {/* ── Edit mode ─────────────────────────────────────────────── */}
                {editingProject === project.id ? (
                  <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Name / icon row */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" style={{ ...input, flex: 1 }} />
                      <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))} placeholder="Icon" style={{ ...input, width: 64 }} />
                      <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)} placeholder="Color" style={{ ...input, width: 110 }} />
                    </div>

                    {/* Creator badge */}
                    {project.createdBy && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--md-surface-cont)", border: "1px solid var(--md-outline-var)" }}>
                        <span style={{ fontSize: 13 }}>🔒</span>
                        <span style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.75 }}>{project.createdBy}</span>
                        <Badge>creator</Badge>
                      </div>
                    )}

                    {/* Edit access */}
                    <div>
                      <label style={label}>Edit Access — Emails</label>
                      <textarea value={editEmails} onChange={(e) => setEditEmails(e.target.value)} placeholder="email1@ex.com, email2@ex.com" rows={2} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                    </div>

                    {/* Guest codes section */}
                    <div style={{ borderTop: "1px solid var(--md-outline-var)", paddingTop: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={sectionLabel}>Guest Invite Codes</span>
                        <button
                          onClick={() => handleGenerateCode(project.id)}
                          disabled={generatingCode === project.id}
                          style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12, opacity: generatingCode === project.id ? 0.6 : 1 }}
                        >
                          {generatingCode === project.id ? "Generating…" : "+ Generate"}
                        </button>
                      </div>

                      {/* New code banner */}
                      {newCode?.projectId === project.id && (
                        <div style={{ background: "rgba(var(--md-primary-rgb,103,80,164),0.07)", border: "1px solid rgba(var(--md-primary-rgb,103,80,164),0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "var(--md-primary)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                            New code — copy now, shown once only
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 800, letterSpacing: "0.3em", color: "var(--md-on-surface)", flex: 1 }}>
                              {newCode.code}
                            </span>
                            <button onClick={() => handleCopy(newCode.code, "code")} style={{ ...btnSecondary, padding: "5px 12px", fontSize: 11 }}>
                              {copiedType === "code" ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(var(--md-primary-rgb,103,80,164),0.15)" }}>
                            <span style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5, flex: 1, wordBreak: "break-all", fontFamily: "monospace" }}>
                              {window.location.origin}/join/{newCode.code}
                            </span>
                            <button onClick={() => handleCopy(`${window.location.origin}/join/${newCode.code}`, "url")} style={{ ...btnSecondary, padding: "5px 12px", fontSize: 11, flexShrink: 0 }}>
                              {copiedType === "url" ? "✓ Copied" : "Copy URL"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Code list */}
                      {(codes[project.id] ?? []).length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(codes[project.id] ?? []).map((c) => {
                            const expires = new Date(c.expiresAt);
                            const isExpired = expires < new Date();
                            const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86400000);
                            return (
                              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--md-surface-cont)", border: "1px solid var(--md-outline-var)" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.7 }}>
                                    {c.createdBy.split("@")[0]} · {new Date(c.createdAt).toLocaleDateString()}
                                  </div>
                                  <div style={{ fontSize: 11, marginTop: 2 }}>
                                    <Badge color={isExpired ? "danger" : "default"}>
                                      {isExpired ? "Expired" : `${daysLeft}d left`}
                                    </Badge>
                                  </div>
                                </div>
                                <button onClick={() => handleDeleteCode(c.id, project.id)} disabled={deletingCode === c.id}
                                  style={{ ...btnDanger, padding: "4px 10px", fontSize: 11, opacity: deletingCode === c.id ? 0.5 : 1 }}>
                                  {deletingCode === c.id ? "…" : "Revoke"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.35, textAlign: "center", padding: "12px 0" }}>
                          No active codes
                        </div>
                      )}
                    </div>

                    {/* Save / cancel */}
                    <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--md-outline-var)", paddingTop: 14 }}>
                      <button onClick={() => handleSaveProject(project.id)} disabled={savingProject} style={{ ...btnPrimary, opacity: savingProject ? 0.6 : 1 }}>{savingProject ? "Saving…" : "Save"}</button>
                      <button onClick={() => setEditingProject(null)} disabled={savingProject} style={btnGhost}>Cancel</button>
                    </div>
                  </div>

                ) : (
                  /* ── View mode ──────────────────────────────────────────────── */
                  <div>
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Project icon */}
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: project.iconColor || "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {project.icon || project.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{project.name}</div>
                        <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.45, marginTop: 1 }}>
                          {projectPages.length} page{projectPages.length !== 1 ? "s" : ""}
                          {project.allowedEmails.length > 0 && ` · ${project.allowedEmails.length} member${project.allowedEmails.length !== 1 ? "s" : ""}`}
                          {project.createdBy === userEmail && " · owner"}
                        </div>
                      </div>

                      {/* Actions */}
                      {canManageProject && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openEditProject(project)} style={{ ...btnSecondary, padding: "5px 12px", fontSize: 12 }}>Edit</button>
                          {deletingProject === project.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, color: "#ef4444" }}>Delete?</span>
                              <button onClick={() => handleDeleteProject(project.id)} disabled={deletingProjectLoading} style={{ ...btnDanger, padding: "5px 10px", opacity: deletingProjectLoading ? 0.6 : 1 }}>{deletingProjectLoading ? "…" : "Yes"}</button>
                              <button onClick={() => setDeletingProject(null)} disabled={deletingProjectLoading} style={{ ...btnGhost, padding: "5px 10px" }}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingProject(project.id)} style={{ ...btnDanger, padding: "5px 10px" }}>Remove</button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pages */}
                    {(projectPages.length > 0 || canAddToProject(project)) && (
                      <div style={{ borderTop: "1px solid var(--md-outline-var)" }}>
                        {projectPages.map((page, idx) => {
                          const canEdit = canManagePage(page);
                          const isActive = page.active !== false;
                          const deleteKey = `${project.id}:${page.name}`;
                          const isEditingThisPage = editingPage === page.name;
                          const isLastRow = idx === projectPages.length - 1 && !canAddToProject(project);
                          return (
                            <div key={page.name}>
                              {/* Page row */}
                              <div style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "9px 16px 9px 20px",
                                borderBottom: (!isLastRow || isEditingThisPage) ? "1px solid var(--md-outline-var)" : "none",
                              }}>
                                {/* Page icon */}
                                <div style={{ width: 26, height: 26, borderRadius: 6, background: page.iconColor || (isActive ? "var(--md-primary)" : "var(--md-surface-cont)"), display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "white" : "var(--md-on-surface)", opacity: isActive ? 1 : 0.4, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                  {page.icon || page.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Page name */}
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--md-on-surface)", opacity: isActive ? 0.85 : 0.4 }}>
                                  {page.name}
                                  {page.hasBackend && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>py</span>}
                                </span>

                                {canEdit && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                    {/* Order arrows */}
                                    <div style={{ display: "flex", flexDirection: "column", marginRight: 2 }}>
                                      <button onClick={() => handleMoveOrder(page.name, projectPages, -1)} disabled={idx === 0} title="Move up" style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.1 : 0.35, fontSize: 8, padding: "1px 4px", color: "var(--md-on-surface)", lineHeight: 1 }}>▲</button>
                                      <button onClick={() => handleMoveOrder(page.name, projectPages, 1)} disabled={idx === projectPages.length - 1} title="Move down" style={{ background: "none", border: "none", cursor: idx === projectPages.length - 1 ? "default" : "pointer", opacity: idx === projectPages.length - 1 ? 0.1 : 0.35, fontSize: 8, padding: "1px 4px", color: "var(--md-on-surface)", lineHeight: 1 }}>▼</button>
                                    </div>

                                    {/* Visibility toggle */}
                                    <label title={isActive ? "Visible" : "Hidden"} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                                      <input type="checkbox" checked={isActive} onChange={(e) => handleToggleActive(page.name, e.target.checked)} style={{ width: 13, height: 13, cursor: "pointer", accentColor: "var(--md-primary)" }} />
                                    </label>

                                    <button
                                      onClick={() => setEditingPage(isEditingThisPage ? null : page.name)}
                                      style={{ background: isEditingThisPage ? "var(--md-primary)" : "transparent", color: isEditingThisPage ? "#fff" : "var(--md-on-surface)", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", opacity: isEditingThisPage ? 1 : 0.55 }}
                                    >
                                      {isEditingThisPage ? "Close" : "Edit"}
                                    </button>

                                    {deletingPage === deleteKey ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <button onClick={() => handleDeletePage(page.name)} style={{ ...btnDanger, padding: "3px 8px", fontSize: 11 }}>Delete</button>
                                        <button onClick={() => setDeletingPage(null)} style={{ ...btnGhost, padding: "3px 8px", fontSize: 11 }}>No</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setDeletingPage(deleteKey)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.3, fontSize: 14, padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}>✕</button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Inline editor — expands below the row */}
                              {isEditingThisPage && (
                                <PageInlineEditor
                                  page={page}
                                  onClose={() => setEditingPage(null)}
                                  onSaved={() => { setEditingPage(null); loadData(true); }}
                                  onFilesReplaced={onPageFilesChanged}
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Add page */}
                        {canAddToProject(project) && editingProject !== project.id && (
                          <div style={{ padding: "8px 16px 10px 20px" }}>
                            {uploadForProject === project.id ? (
                              <UploadForm projectId={project.id} onClose={() => setUploadForProject(null)} onUploaded={() => loadData(true)} />
                            ) : (
                              <button onClick={() => setUploadForProject(project.id)}
                                style={{ background: "none", border: "1px dashed var(--md-outline-var)", borderRadius: 8, padding: "6px 0", fontSize: 12, color: "var(--md-on-surface)", opacity: 0.35, cursor: "pointer", width: "100%", textAlign: "center", transition: "opacity 0.15s" }}>
                                + Add page
                              </button>
                            )}
                          </div>
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

// ── Main Admin Panel ───────────────────────────────────────────────────────────
export function AdminModal({ onClose, userEmail, isAdmin, selectedProjectId, onSelectProject, projects, onPageFilesChanged }: AdminModalProps) {
  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--md-surface-cont)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", gap: 10, borderBottom: "1px solid var(--md-outline-var)", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--md-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--md-on-surface)", letterSpacing: "-0.01em" }}>Admin</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.35, fontSize: 20, lineHeight: 1, padding: "2px 6px", borderRadius: 6 }}>×</button>
        </div>

        {/* Active project selector */}
        {projects.length > 0 && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--md-outline-var)", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--md-on-surface)", opacity: 0.35, marginBottom: 8 }}>Active project</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {projects.map((p) => {
                const isActive = p.id === selectedProjectId;
                return (
                  <button key={p.id} onClick={() => onSelectProject(p.id)} title={p.name}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
                      borderRadius: 20, fontSize: 12, fontWeight: isActive ? 600 : 400,
                      border: isActive ? "1.5px solid var(--md-primary)" : "1px solid var(--md-outline-var)",
                      background: isActive ? "rgba(var(--md-primary-rgb,103,80,164),0.08)" : "transparent",
                      color: isActive ? "var(--md-primary)" : "var(--md-on-surface)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <span style={{ fontSize: 13 }}>{p.icon || p.name.charAt(0).toUpperCase()}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px" }}>
          <ProjectsTab userEmail={userEmail} isAdmin={isAdmin} onPageFilesChanged={onPageFilesChanged} />
        </div>
      </div>
    </>
  );
}
