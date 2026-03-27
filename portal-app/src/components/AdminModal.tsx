"use client";

import React, { useState, useEffect, useCallback } from "react";

const spinKeyframes = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export interface AdminModalProps {
  onClose: () => void;
}

interface PageInfo {
  name: string;
  hasBackend: boolean;
  active: boolean;
  allowedGroups: string[];
  icon?: string;
  iconColor?: string;
}

// ── Pages Management Component ────────────────────────────────────────────────
function PagesTab() {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [backendFile, setBackendFile] = useState<File | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editGroups, setEditGroups] = useState("");
  const [deletingPage, setDeletingPage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editModalPage, setEditModalPage] = useState<PageInfo | null>(null);
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editBackendFile, setEditBackendFile] = useState<File | null>(null);
  const [removeBackend, setRemoveBackend] = useState(false);
  const [editIcon, setEditIcon] = useState("");
  const [editIconColor, setEditIconColor] = useState("");
  const [updatingPage, setUpdatingPage] = useState(false);

  const loadPages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pages");
      const data = await res.json() as { pages: PageInfo[] };
      setPages(data.pages);
    } catch {
      setError("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

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
      const res = await fetch("/api/admin/pages", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      setShowUpload(false);
      setNewPageName("");
      setHtmlFile(null);
      setBackendFile(null);
      loadPages();
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

  const handleSaveGroups = async (name: string) => {
    const groups = editGroups.split(",").map((g) => g.trim()).filter(Boolean);
    try {
      await fetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, allowedGroups: groups }),
      });
      setPages((prev) => prev.map((p) => p.name === name ? { ...p, allowedGroups: groups } : p));
      setEditingPage(null);
    } catch {
      setError("Failed to update groups");
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
          Available Pages ({pages.length})
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowTemplates(!showTemplates)}
              style={{ background: "var(--md-surface-cont)", color: "var(--md-on-surface)", border: "1px solid var(--md-outline)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              📄 Templates ▾
            </button>
            {showTemplates && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--md-surface)", border: "1px solid var(--md-outline-var)", borderRadius: 8, padding: 8, zIndex: 10, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                <button onClick={() => { window.open("/page-templates/blank.html", "_blank"); setShowTemplates(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>
                  📄 blank.html
                </button>
                <button onClick={() => { window.open("/page-templates/backend.py", "_blank"); setShowTemplates(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "var(--md-on-surface)", fontSize: 12 }}>
                  🐍 backend.py
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setShowUpload(!showUpload)}
            style={{ background: "var(--md-primary)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Add Page
          </button>
        </div>
      </div>

      {showUpload && (
        <div style={{ background: "var(--md-surface)", borderRadius: 12, padding: 16, border: "1px solid var(--md-outline-var)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>Page Name</label>
              <input type="text" value={newPageName} onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., docs, help, dashboard" style={{ ...inputStyle, width: "100%" }} />
              <p style={{ fontSize: 11, opacity: 0.5, color: "var(--md-on-surface)", margin: "4px 0 0" }}>
                Only letters, numbers, underscores and hyphens
              </p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>HTML File *</label>
              <input type="file" accept=".html" onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>Backend (optional Python)</label>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pages.map((page) => (
            <div key={page.name}
              style={{ background: "var(--md-surface)", borderRadius: 10, padding: 14, border: "1px solid var(--md-outline-var)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: page.iconColor || (page.active ? "var(--md-primary)" : "var(--md-surface-cont)"), display: "flex", alignItems: "center", justifyContent: "center", color: page.active ? "white" : "var(--md-on-surface)", opacity: page.active ? 1 : 0.4, fontSize: 14, fontWeight: 600 }}>
                {page.icon || page.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)", opacity: page.active ? 1 : 0.5 }}>
                  {page.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.5 }}>
                  {page.hasBackend ? "✓ Has backend" : "HTML only"}
                  {page.allowedGroups.length > 0 ? ` • Groups: ${page.allowedGroups.join(", ")}` : " • All users"}
                </div>
              </div>
              {editingPage === page.name ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="text" value={editGroups} onChange={(e) => setEditGroups(e.target.value)}
                    placeholder="group1, group2" style={{ ...inputStyle, width: 160, padding: "6px 10px", fontSize: 12 }} />
                  <button onClick={() => handleSaveGroups(page.name)} style={{ ...primaryBtnStyle, padding: "6px 12px", fontSize: 11 }}>Save</button>
                  <button onClick={() => setEditingPage(null)} style={{ ...ghostBtnStyle }}>×</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={page.active} onChange={(e) => handleToggleActive(page.name, e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 11, color: "var(--md-on-surface)", opacity: 0.7 }}>Active</span>
                  </label>
                  <button onClick={() => { setEditingPage(page.name); setEditGroups(page.allowedGroups.join(", ")); }}
                    style={{ ...ghostBtnStyle, opacity: 0.6 }}>Groups</button>
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
                </div>
              )}
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
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>Icon (single character or emoji)</label>
                  <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value.slice(0, 2))}
                    placeholder={editModalPage.name.charAt(0).toUpperCase()} style={{ ...inputStyle, width: "100%", padding: "8px 12px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>Icon Color (CSS)</label>
                  <input type="text" value={editIconColor} onChange={(e) => setEditIconColor(e.target.value)}
                    placeholder="#1a73e8" style={{ ...inputStyle, width: "100%", padding: "8px 12px" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>New HTML File (leave empty to keep existing)</label>
                <input type="file" accept=".html" onChange={(e) => setEditHtmlFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12, color: "var(--md-on-surface)" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, opacity: 0.7, color: "var(--md-on-surface)", marginBottom: 4 }}>New Backend File (leave empty to keep existing)</label>
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
export function AdminModal({ onClose }: AdminModalProps) {
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
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>Admin — Pages</div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface)", opacity: 0.5 }}>Manage portal pages</div>
            </div>
            <button onClick={onClose}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface)", opacity: 0.5, fontSize: 20, lineHeight: 1, padding: "4px 8px", borderRadius: 8 }}>
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <PagesTab />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────
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
