import { useEffect } from "react";

const SITE = "SmartCart AI";

/** Per-page <title> and meta description (SEO + screen readers announce page changes). */
export default function useDocumentTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} - AI-Powered Smart Shopping`;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", description.slice(0, 160));
    }
  }, [title, description]);
}
