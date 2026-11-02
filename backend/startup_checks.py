"""
Fail-fast configuration checks, run when the app module is imported.

On Vercel the Python function imports app.py on its first (cold) request, so a
failed check crashes the function immediately with a clear message in the
Vercel logs: every request returns 500 instead of the site looking healthy
while login is silently broken.
"""
import os

# Values that must never sign tokens in production: the old hard-coded key from git history,
# the dev fallback below, and the placeholder from .env.example docs.
KNOWN_INSECURE_KEYS = {
    "smartcart_secret_key_12345",
    "dev-only-insecure-secret-change-me",
    "change-me",
    "changeme",
    "secret",
}
MIN_KEY_LENGTH = 32
DEV_FALLBACK_KEY = "dev-only-insecure-secret-change-me"


class ConfigError(RuntimeError):
    pass


def is_production(env=None):
    env = os.environ if env is None else env
    # VERCEL=1 is set by Vercel for builds and functions (all of production, preview and development deployments).
    return bool(env.get("VERCEL")) or env.get("FLASK_ENV") == "production" or env.get("APP_ENV") == "production"


def resolve_secret_key(env=None):
    """
    The SECRET_KEY to sign auth tokens with.
    Production: must be set, at least 32 characters, and not a known/insecure value -> else ConfigError.
    Local dev: falls back to an insecure dev key so `flask run` works without setup.
    """
    env = os.environ if env is None else env
    key = (env.get("SECRET_KEY") or "").strip()
    if not is_production(env):
        return key or DEV_FALLBACK_KEY
    if not key:
        raise ConfigError(
            "SECRET_KEY is not set. Add it in Vercel -> backend project -> Settings -> Environment Variables, "
            "then redeploy. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    if key in KNOWN_INSECURE_KEYS:
        raise ConfigError("SECRET_KEY uses a known/insecure value. Generate a new random key and redeploy.")
    if len(key) < MIN_KEY_LENGTH:
        raise ConfigError(f"SECRET_KEY is too short ({len(key)} chars); use at least {MIN_KEY_LENGTH} random characters.")
    return key


def run_startup_checks():
    resolve_secret_key()
