import { Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-6xl mb-4" aria-hidden="true">🧭</p>
      <h1 className="text-2xl font-bold mb-2">We couldn't find that page</h1>
      <p className="text-gray-600 mb-6">The link may be broken or the page may have moved.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-primary btn-3d px-5">Go home</Link>
        <Link to="/ai-chat" className="btn-outline-primary px-5">Ask the AI assistant</Link>
      </div>
    </div>
  );
}
