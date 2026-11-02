import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useChat from "../../hooks/useChat";
import ChatThread from "./ChatThread";

/**
 * Floating assistant available on every page: a 3D "bubble" launcher with a
 * pulse ring that expands (3D tilt-in) into a compact chat panel.
 * Hidden on /ai-chat (full page) and admin pages.
 */
function WidgetPanel({ onClose }) {
  const chat = useChat();
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.querySelector("input")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="SmartCart AI assistant"
      className="chat-panel-3d fixed z-[55] bottom-0 right-0 sm:bottom-24 sm:right-5 w-full sm:w-[400px] h-[85dvh] sm:h-[600px] max-h-[100dvh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-primary-900 text-white">
        <div>
          <p className="font-bold text-sm">🤖 SmartCart AI</p>
          <p className="text-[11px] text-white/70">Semantic search · cart · orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/ai-chat" onClick={onClose} className="text-[11px] text-white/80 hover:text-white underline">Full screen</Link>
          <button type="button" onClick={onClose} aria-label="Close assistant" className="text-xl leading-none text-white/80 hover:text-white">×</button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChatThread chat={chat} compact heightClass="h-full" />
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  if (pathname.startsWith("/ai-chat") || pathname.startsWith("/admin")) return null;

  return (
    <>
      {open && <WidgetPanel onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close SmartCart AI assistant" : "Open SmartCart AI assistant"}
        className={`chat-fab fixed z-[56] bottom-5 right-5 w-14 h-14 rounded-full text-white text-2xl flex items-center justify-center ${open ? "hidden sm:flex" : "flex"}`}
      >
        <span aria-hidden="true">{open ? "×" : "💬"}</span>
      </button>
    </>
  );
}
