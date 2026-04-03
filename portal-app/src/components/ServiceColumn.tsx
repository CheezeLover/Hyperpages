"use client";

import React from "react";

interface Page {
  name: string;
  icon?: string;
  iconColor?: string;
}

interface ServiceColumnProps {
  isPortraitMode: boolean;
  pages: Page[];
  selectedPage: Page | null;
  onSelectPage: (page: Page) => void;
  onExportPdf: () => void;
  isExporting?: boolean;
  adminOpen: boolean;
  canAccessAdmin?: boolean;
  onOpenAdmin: () => void;
  onDisconnect?: () => void;
}

function pageIcon(name: string, icon?: string, iconColor?: string, active?: boolean) {
  const displayChar = icon || name.charAt(0).toUpperCase();
  const color = iconColor || "currentColor";
  return (
    <svg viewBox="0 0 24 24" width={26} height={26}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill={color} opacity={active ? 0.22 : 0.11} />
      <text
        x="12" y="16.5" textAnchor="middle" fontSize="11"
        fontFamily="system-ui,sans-serif" fontWeight="700"
        fill={color} opacity={active ? 1 : 0.55}
      >
        {displayChar}
      </text>
    </svg>
  );
}

function ServiceBtn({
  active, tooltip, onClick, colorScheme, isPortrait, children,
}: {
  active: boolean;
  tooltip: string;
  onClick: () => void;
  colorScheme: "primary" | "secondary";
  isPortrait: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  const isPrimary = colorScheme === "primary";

  const bgColor = active
    ? isPrimary ? "var(--md-primary)" : "rgba(211, 84, 0, 0.12)"
    : hovered
    ? isPrimary ? "var(--md-primary-cont)" : "rgba(211, 84, 0, 0.07)"
    : "transparent";

  const iconColor = active
    ? isPrimary ? "#ffffff" : "var(--md-primary)"
    : hovered
    ? isPrimary ? "var(--md-primary)" : "var(--md-on-surface)"
    : "var(--md-on-surface)";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={tooltip}
        style={{
          width: 40,
          height: 40,
          border: "none",
          borderRadius: "var(--radius-m)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bgColor,
          color: iconColor,
          position: "relative",
          overflow: "hidden",
          transition: "background 0.18s, color 0.18s",
          boxShadow: "none",
          opacity: active || hovered ? 1 : 0.65,
        }}
      >
        {/* Active indicator strip */}
        {active && (
          <span style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: isPortrait ? "100%" : 2,
            height: isPortrait ? 2 : "100%",
            background: "var(--md-primary)",
            borderRadius: 1,
            pointerEvents: "none",
          }} />
        )}
        {children}
      </button>

      {/* Tooltip */}
      {hovered && !isPortrait && (
        <div style={{
          position: "absolute",
          right: "calc(100% + 10px)",
          top: "50%",
          transform: "translateY(-50%)",
          background: "var(--md-surface-cont-hi)",
          color: "var(--md-on-surface)",
          padding: "5px 11px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          boxShadow: "0 2px 12px rgba(0,0,0,.14)",
          zIndex: 999,
          letterSpacing: "0.01em",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

const EDGE_TRIGGER_PX = 20;
const AUTO_HIDE_MS    = 2000;

export function ServiceColumn({ isPortraitMode, pages, selectedPage, onSelectPage, onExportPdf, isExporting, adminOpen, canAccessAdmin = true, onOpenAdmin, onDisconnect }: ServiceColumnProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const scheduleHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setCollapsed(true), AUTO_HIDE_MS);
  }, []);

  const showBar = React.useCallback(() => {
    setCollapsed(false);
    scheduleHide();
  }, [scheduleHide]);

  React.useEffect(() => {
    setCollapsed(false);
    if (isFullscreen) {
      scheduleHide();
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [isFullscreen, scheduleHide]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fullscreenStyle: React.CSSProperties = isFullscreen
    ? isPortraitMode
      ? {
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          zIndex: 100,
          transform: collapsed ? "translateY(100%)" : "translateY(0)",
          transition: "transform 0.25s ease",
          boxShadow: collapsed ? "none" : "0 -4px 20px rgba(0,0,0,0.18)",
        }
      : {
          position: "fixed",
          right: 0,
          top: 0,
          height: "100%",
          zIndex: 100,
          transform: collapsed ? "translateX(100%)" : "translateX(0)",
          transition: "transform 0.25s ease",
          boxShadow: collapsed ? "none" : "-4px 0 20px rgba(0,0,0,0.18)",
        }
    : {};

  return (
    <>
    <div
      onMouseEnter={() => {
        if (isFullscreen && !isPortraitMode) {
          if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
        }
      }}
      onMouseLeave={() => {
        if (isFullscreen && !isPortraitMode) scheduleHide();
      }}
      style={{
        display: "flex",
        flexDirection: isPortraitMode ? "row" : "column",
        alignItems: "center",
        justifyContent: isPortraitMode ? "space-between" : "flex-start",
        padding: isPortraitMode ? "0 12px" : "8px 0",
        gap: isPortraitMode ? 6 : 4,
        width: isPortraitMode ? "100%" : 48,
        minWidth: isPortraitMode ? "100%" : 48,
        height: isPortraitMode ? 48 : "100%",
        flexShrink: 0,
        background: "var(--md-surface)",
        borderLeft: isPortraitMode ? "none" : "1px solid var(--md-outline-var)",
        borderTop: isPortraitMode ? "1px solid var(--md-outline-var)" : "none",
        zIndex: 20,
        order: 99,
        ...fullscreenStyle,
      }}
    >
      {/* Page buttons */}
      {pages.map((page) => (
        <ServiceBtn
          key={page.name}
          active={selectedPage?.name === page.name}
          tooltip={page.name.charAt(0).toUpperCase() + page.name.slice(1)}
          onClick={() => onSelectPage(page)}
          colorScheme="secondary"
          isPortrait={isPortraitMode}
        >
          {pageIcon(page.name, page.icon, page.iconColor, selectedPage?.name === page.name)}
        </ServiceBtn>
      ))}

      {!isPortraitMode && <div style={{ flex: 1 }} />}

      {/* Fullscreen toggle */}
      <ServiceBtn active={false} tooltip={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} colorScheme="secondary" isPortrait={isPortraitMode}>
        {isFullscreen ? (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        )}
      </ServiceBtn>

      {/* Export */}
      {!isFullscreen && pages.length > 0 && (
        <ServiceBtn active={false} tooltip={isExporting ? "Exporting…" : "Export"} onClick={onExportPdf} colorScheme="secondary" isPortrait={isPortraitMode}>
          {isExporting ? (
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" style={{ opacity: 0.5 }}>
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5h3V9h4v3h3l-5 5z"/>
            </svg>
          )}
        </ServiceBtn>
      )}

      {/* Admin settings */}
      {!isFullscreen && canAccessAdmin && (
        <ServiceBtn active={adminOpen} tooltip="Settings" onClick={onOpenAdmin} colorScheme="secondary" isPortrait={isPortraitMode}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </ServiceBtn>
      )}

      {/* Disconnect */}
      {!isFullscreen && onDisconnect && (
        <ServiceBtn active={false} tooltip="Disconnect" onClick={onDisconnect} colorScheme="secondary" isPortrait={isPortraitMode}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
        </ServiceBtn>
      )}
    </div>

    {/* ── Fullscreen hot-zone — landscape (right edge) ──────────────────── */}
    {isFullscreen && !isPortraitMode && (
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          width: collapsed ? EDGE_TRIGGER_PX : 0,
          height: "100%",
          zIndex: 99,
          overflow: "hidden",
        }}
        onMouseEnter={() => { showBar(); window.focus(); }}
      />
    )}

    {/* ── Fullscreen hot-zone — portrait (bottom edge) ───────────────────── */}
    {isFullscreen && isPortraitMode && (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          height: collapsed ? EDGE_TRIGGER_PX : 0,
          zIndex: 99,
          overflow: "hidden",
        }}
        onMouseEnter={() => { showBar(); window.focus(); }}
      />
    )}
    </>
  );
}
