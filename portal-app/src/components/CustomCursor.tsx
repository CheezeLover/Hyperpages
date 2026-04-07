'use client';

import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    let isClicked = false;

    const move = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };

    const down = () => {
      isClicked = true;
      cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
      cursor.style.background = '#FF6600';
    };

    const up = () => {
      isClicked = false;
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'var(--md-on-surface)';
    };

    const attachListeners = (el: Element) => {
      el.addEventListener('mousemove', move as EventListener);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
    };

    const detachListeners = (el: Element) => {
      el.removeEventListener('mousemove', move as EventListener);
      el.removeEventListener('mousedown', down);
      el.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);

    const observer = new MutationObserver(() => {
      document.querySelectorAll('iframe').forEach((iframe) => {
        attachListeners(iframe);
        const doc = iframe.contentDocument;
        if (doc) {
          doc.addEventListener('mousemove', move);
          doc.addEventListener('mousedown', down);
          doc.addEventListener('mouseup', up);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll('iframe').forEach((iframe) => {
      attachListeners(iframe);
      const doc = iframe.contentDocument;
      if (doc) {
        doc.addEventListener('mousemove', move);
        doc.addEventListener('mousedown', down);
        doc.addEventListener('mouseup', up);
      }
    });

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      observer.disconnect();
      document.querySelectorAll('iframe').forEach((iframe) => {
        detachListeners(iframe);
        const doc = iframe.contentDocument;
        if (doc) {
          doc.removeEventListener('mousemove', move);
          doc.removeEventListener('mousedown', down);
          doc.removeEventListener('mouseup', up);
        }
      });
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--md-on-surface)',
        pointerEvents: 'none',
        zIndex: 9999,
        transform: 'translate(-50%, -50%)',
        transition: 'transform 0.1s ease, background 0.1s ease',
        mixBlendMode: 'difference',
      }}
    />
  );
}
