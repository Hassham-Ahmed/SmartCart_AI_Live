"""
Idempotent schema additions used by the order service and the AI layer.

Only CREATE TABLE IF NOT EXISTS statements run at runtime (cheap, safe on a
cold start). Column changes on existing tables live in scripts/migrate.py and
are run once by hand.
"""
import threading

from config import get_db

_lock = threading.Lock()
_done = False

TABLES = [
    # Line items for each order - previously orders had no record of WHAT was bought.
    """
    CREATE TABLE IF NOT EXISTS order_items (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        order_id    INT NOT NULL,
        product_id  INT NOT NULL,
        name        VARCHAR(255) NOT NULL,
        price       DECIMAL(12,2) NOT NULL,
        quantity    INT NOT NULL DEFAULT 1,
        INDEX idx_order_items_order (order_id),
        INDEX idx_order_items_product (product_id)
    )
    """,
    # Vector store: one row per product, float32 little-endian blob.
    """
    CREATE TABLE IF NOT EXISTS product_embeddings (
        product_id   INT PRIMARY KEY,
        model        VARCHAR(64) NOT NULL,
        dims         SMALLINT NOT NULL,
        content_hash CHAR(40) NOT NULL,
        embedding    MEDIUMBLOB NOT NULL,
        updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    """,
    # Short-term conversation context (used when Redis is not configured).
    """
    CREATE TABLE IF NOT EXISTS ai_sessions (
        session_id  VARCHAR(64) PRIMARY KEY,
        user_id     INT NULL,
        context     MEDIUMTEXT NOT NULL,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ai_sessions_user (user_id)
    )
    """,
    # Long-term user memory: preferences + a taste embedding.
    """
    CREATE TABLE IF NOT EXISTS ai_user_profiles (
        user_id         INT PRIMARY KEY,
        profile         MEDIUMTEXT NOT NULL,
        taste_embedding MEDIUMBLOB NULL,
        updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    """,
    # Product views, for personalization ("viewed" history).
    """
    CREATE TABLE IF NOT EXISTS product_views (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        product_id  INT NOT NULL,
        viewed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_views_user (user_id, viewed_at)
    )
    """,
    # Turn-level logs for evaluation / debugging.
    """
    CREATE TABLE IF NOT EXISTS ai_chat_logs (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        session_id     VARCHAR(64),
        user_id        INT NULL,
        query          TEXT,
        intent         VARCHAR(32),
        retrieved_ids  TEXT,
        tools_called   TEXT,
        response       MEDIUMTEXT,
        latency_ms     INT,
        input_tokens   INT,
        output_tokens  INT,
        error          TEXT,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logs_created (created_at)
    )
    """,
]


def ensure_schema():
    global _done
    if _done:
        return
    with _lock:
        if _done:
            return
        db = get_db()
        cur = db.cursor()
        try:
            for ddl in TABLES:
                cur.execute(ddl)
            db.commit()
            _done = True
        finally:
            cur.close()
            db.close()
