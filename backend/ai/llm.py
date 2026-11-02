"""
Thin wrapper around the Google Gemini SDK (google-genai).

Provider choice: the project already used Gemini (GEMINI_API_KEY,
google-genai in requirements.txt), so we stay on it:
  * chat model      -> GEMINI_CHAT_MODEL  (default: gemini-3.1-flash-lite, same as before)
  * embedding model -> GEMINI_EMBED_MODEL (default: gemini-embedding-001)
One provider = one key, one bill, one SDK. Switching to OpenAI
text-embedding-3-small would add a second vendor for no quality gain.
"""
import os
import time

import numpy as np

try:
    from google import genai
    from google.genai import types
except ImportError:  # SDK missing -> AI degrades to retrieval-only keyword search
    genai = None
    types = None

CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.1-flash-lite")
EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
# 768 dims (Matryoshka-truncated) keeps ~98% of retrieval quality of 3072
# while using 4x less storage/RAM. Truncated vectors must be re-normalised.
EMBED_DIMS = int(os.getenv("GEMINI_EMBED_DIMS", "768"))
MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "700"))

_client = None


def get_client():
    global _client
    if _client is None and genai is not None:
        key = os.getenv("GEMINI_API_KEY")
        if key:
            _client = genai.Client(api_key=key)
    return _client


def available():
    return get_client() is not None


def _normalize(mat):
    mat = np.asarray(mat, dtype=np.float32)
    norms = np.linalg.norm(mat, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0
    return mat / norms


def embed_texts(texts, task_type="RETRIEVAL_DOCUMENT", batch_size=100, retries=3):
    """Embed a list of strings -> (n, EMBED_DIMS) float32 L2-normalised matrix."""
    client = get_client()
    if client is None:
        raise RuntimeError("Gemini client not configured (GEMINI_API_KEY missing).")
    out = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        for attempt in range(retries):
            try:
                res = client.models.embed_content(
                    model=EMBED_MODEL,
                    contents=batch,
                    config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBED_DIMS),
                )
                out.extend(e.values for e in res.embeddings)
                break
            except Exception as e:  # noqa: BLE001 - rate limits/transient errors
                if attempt == retries - 1:
                    raise
                wait = 2 ** (attempt + 1)
                print(f"embed batch failed ({e}); retrying in {wait}s")
                time.sleep(wait)
    return _normalize(out)


def embed_query(text):
    return embed_texts([text], task_type="RETRIEVAL_QUERY")[0]
