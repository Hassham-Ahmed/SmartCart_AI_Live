import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

// The chat widget is not needed for first paint: load it after the page.
const ChatWidget = lazy(() => import("./chat/ChatWidget"));

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fbff]">
      <a href="#main" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<p className="text-center text-gray-500 py-24" role="status">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
