"""Rappels quotidiens (Web Push) pour xuehanyu.org.

Un petit service HTTP + un ordonnanceur, sans compte ni identité : l'abonnement push
du navigateur est le seul identifiant. Chaque minute, pour chaque abonné dont l'heure
de rappel est passée dans SON fuseau, on envoie une notification s'il n'a pas encore
pratiqué ce jour-là (le client signale son activité via /activity).

    POST /api/push/subscribe     crée ou met à jour (heure, fuseau, langue, activité)
    POST /api/push/resubscribe   le navigateur a renouvelé l'abonnement
    POST /api/push/activity      « j'ai pratiqué aujourd'hui » : coupe le rappel du jour
    POST /api/push/unsubscribe   supprime
    GET  /api/push/key           clé publique VAPID
    GET  /api/push/health

Configuration par variables d'environnement : voir `Config.from_env`.
"""
import base64
import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

log = logging.getLogger("xuehanyu-push")

# L'endpoint vient du client : on ne POSTe que vers les vrais services push (anti-SSRF).
ALLOWED_HOST_SUFFIXES = (
    ".googleapis.com",            # FCM (Chrome, Edge, Android)
    ".push.services.mozilla.com",  # Firefox
    ".push.apple.com",            # Safari / iOS
    ".notify.windows.com",        # anciens Edge
)
MAX_BODY = 4096
INACTIVE_DAYS = 14          # plus de rappel après 14 jours sans pratique
SEND_WINDOW_MIN = 180       # on n'envoie plus un rappel de 19:00 à 23:30 après une panne
MAX_FAILS = 5
DAY_FMT = "%Y-%m-%d"

MESSAGES = {
    "fr": {
        "title": "学汉语",
        "streak": "Ta série de {n} jours t'attend : quelques mots suffisent pour la garder.",
        "plain": "C'est l'heure de ta pratique du jour : quelques mots, quelques minutes.",
    },
    "en": {
        "title": "学汉语",
        "streak": "Your {n}-day streak is waiting: a few words are enough to keep it.",
        "plain": "Time for today's practice: a few words, a few minutes.",
    },
}


@dataclass
class Config:
    db_path: str
    key_path: str
    port: int = 3004
    host: str = "127.0.0.1"
    subject: str = "mailto:noreply@intarynx.com"

    @classmethod
    def from_env(cls):
        state = os.environ.get("STATE_DIRECTORY", "/var/lib/xuehanyu-push")
        return cls(
            db_path=os.environ.get("PUSH_DB", os.path.join(state, "subs.db")),
            key_path=os.environ.get("VAPID_PRIVATE_KEY_FILE", os.path.join(state, "vapid_private.pem")),
            port=int(os.environ.get("PUSH_PORT", "3004")),
            host=os.environ.get("PUSH_HOST", "127.0.0.1"),
            subject=os.environ.get("VAPID_SUBJECT", "mailto:noreply@intarynx.com"),
        )


# --------------------------------------------------------------------------- VAPID
def load_or_create_vapid(key_path):
    """Retourne (Vapid, clé publique base64url). Crée la clé au premier démarrage."""
    from py_vapid import Vapid
    from cryptography.hazmat.primitives import serialization

    if not os.path.exists(key_path):
        os.makedirs(os.path.dirname(key_path), exist_ok=True)
        v = Vapid()
        v.generate_keys()
        fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(v.private_pem())
        log.info("clé VAPID créée : %s", key_path)
    vapid = Vapid.from_file(key_path)
    raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return vapid, base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


# --------------------------------------------------------------------------- stockage
SCHEMA = """
CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  remind TEXT NOT NULL,
  tz TEXT NOT NULL,
  lang TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active_day TEXT,
  last_sent_day TEXT,
  fails INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
"""


def connect(path):
    if os.path.dirname(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
    db = sqlite3.connect(path, timeout=10, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript(SCHEMA)
    return db


def sub_id(endpoint):
    return hashlib.sha256(endpoint.encode()).hexdigest()[:32]


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------- validation
def valid_endpoint(url):
    try:
        p = urlparse(url)
    except ValueError:
        return False
    host = (p.hostname or "").lower()
    return (p.scheme == "https" and len(url) <= 1024 and p.port in (None, 443)
            and any(host.endswith(s) for s in ALLOWED_HOST_SUFFIXES))


def valid_time(v):
    return isinstance(v, str) and len(v) == 5 and v[2] == ":" and v[:2].isdigit() and v[3:].isdigit() \
        and int(v[:2]) < 24 and int(v[3:]) < 60


def valid_day(v):
    try:
        datetime.strptime(v, DAY_FMT)
        return True
    except (TypeError, ValueError):
        return False


def valid_tz(v):
    try:
        ZoneInfo(v)
        return True
    except Exception:
        return False


def clean_streak(v):
    return max(0, min(int(v), 100000)) if isinstance(v, int) and not isinstance(v, bool) else 0


# --------------------------------------------------------------------------- opérations
def upsert(db, body):
    sub = body.get("subscription") or {}
    keys = sub.get("keys") or {}
    endpoint, p256dh, auth = sub.get("endpoint"), keys.get("p256dh"), keys.get("auth")
    if not (isinstance(endpoint, str) and isinstance(p256dh, str) and isinstance(auth, str)
            and 0 < len(p256dh) <= 200 and 0 < len(auth) <= 100):
        raise ValueError("abonnement invalide")
    if not valid_endpoint(endpoint):
        raise ValueError("endpoint refusé")
    remind, tz, lang = body.get("time"), body.get("tz"), body.get("lang")
    if not valid_time(remind) or not valid_tz(tz):
        raise ValueError("heure ou fuseau invalide")
    lang = lang if lang in MESSAGES else "fr"
    day = body.get("day") if valid_day(body.get("day")) else None
    active = day if day and (body.get("today") or 0) > 0 else None
    streak = clean_streak(body["streak"]) if "streak" in body else None   # absent : on garde l'ancienne valeur
    now = now_iso()
    db.execute("""
      INSERT INTO subs (id, endpoint, p256dh, auth, remind, tz, lang, streak, last_active_day, created_at, updated_at)
      VALUES (:id, :endpoint, :p256dh, :auth, :remind, :tz, :lang, COALESCE(:streak, 0), :active, :now, :now)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh=:p256dh, auth=:auth, remind=:remind, tz=:tz, lang=:lang, fails=0, updated_at=:now,
        streak=COALESCE(:streak, subs.streak),
        last_active_day=COALESCE(:active, subs.last_active_day)
    """, {"id": sub_id(endpoint), "endpoint": endpoint, "p256dh": p256dh, "auth": auth, "remind": remind,
          "tz": tz, "lang": lang, "streak": streak, "active": active, "now": now})
    db.commit()


def activity(db, body):
    endpoint = body.get("endpoint")
    if not isinstance(endpoint, str) or not valid_day(body.get("day")):
        raise ValueError("requête invalide")
    if (body.get("today") or 0) <= 0:
        return
    db.execute("UPDATE subs SET last_active_day=?, streak=?, fails=0, updated_at=? WHERE endpoint=?",
               (body["day"], clean_streak(body.get("streak")), now_iso(), endpoint))
    db.commit()


def unsubscribe(db, body):
    endpoint = body.get("endpoint")
    if isinstance(endpoint, str):
        db.execute("DELETE FROM subs WHERE endpoint=?", (endpoint,))
        db.commit()


def resubscribe(db, body):
    """Le navigateur a changé d'abonnement : on garde les réglages de l'ancien."""
    sub = body.get("subscription") or {}
    keys = sub.get("keys") or {}
    old = db.execute("SELECT * FROM subs WHERE endpoint=?", (body.get("old"),)).fetchone()
    if not old or not valid_endpoint(sub.get("endpoint", "")):
        raise ValueError("ancien abonnement inconnu")
    upsert(db, {"subscription": {"endpoint": sub["endpoint"], "keys": keys}, "time": old["remind"],
                "tz": old["tz"], "lang": old["lang"], "streak": old["streak"]})
    unsubscribe(db, {"endpoint": old["endpoint"]})


# --------------------------------------------------------------------------- ordonnanceur
def due(row, now_utc):
    """Vrai si ce rappel doit partir maintenant. `now_utc` est aware (UTC)."""
    local = now_utc.astimezone(ZoneInfo(row["tz"]))
    day = local.strftime(DAY_FMT)
    if row["last_sent_day"] == day or row["last_active_day"] == day:
        return False
    h, m = int(row["remind"][:2]), int(row["remind"][3:])
    late = (local.hour * 60 + local.minute) - (h * 60 + m)
    if not 0 <= late < SEND_WINDOW_MIN:
        return False
    ref = row["last_active_day"] or row["created_at"][:10]
    try:
        idle = (local.date() - datetime.strptime(ref, DAY_FMT).date()).days
    except ValueError:
        idle = 0
    return idle <= INACTIVE_DAYS


def message_for(row, now_utc):
    local = now_utc.astimezone(ZoneInfo(row["tz"]))
    yesterday = (local - timedelta(days=1)).strftime(DAY_FMT)
    m = MESSAGES.get(row["lang"], MESSAGES["fr"])
    alive = row["last_active_day"] == yesterday and row["streak"] >= 2
    return {"title": m["title"], "body": m["streak"].format(n=row["streak"]) if alive else m["plain"],
            "url": "/quiz.html"}


def default_sender(vapid, subject):
    from pywebpush import webpush, WebPushException

    def send(row, payload):
        try:
            webpush(
                subscription_info={"endpoint": row["endpoint"], "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}},
                data=json.dumps(payload), vapid_private_key=vapid, vapid_claims={"sub": subject}, ttl=6 * 3600)
            return "ok"
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            return "gone" if status in (404, 410) else "fail"
        except Exception:  # réseau, etc. : transitoire
            return "fail"
    return send


def run_once(db, send, now_utc=None):
    """Un passage de l'ordonnanceur. Retourne le nombre de notifications envoyées."""
    now_utc = now_utc or datetime.now(timezone.utc)
    sent = 0
    for row in db.execute("SELECT * FROM subs").fetchall():
        try:
            if not due(row, now_utc):
                continue
            result = send(row, message_for(row, now_utc))
        except Exception:
            log.exception("rappel %s", row["id"])
            continue
        if result == "ok":
            local_day = now_utc.astimezone(ZoneInfo(row["tz"])).strftime(DAY_FMT)
            db.execute("UPDATE subs SET last_sent_day=?, fails=0 WHERE id=?", (local_day, row["id"]))
            sent += 1
        elif result == "gone":
            db.execute("DELETE FROM subs WHERE id=?", (row["id"],))
        else:
            fails = row["fails"] + 1
            if fails >= MAX_FAILS:
                db.execute("DELETE FROM subs WHERE id=?", (row["id"],))
            else:
                db.execute("UPDATE subs SET fails=? WHERE id=?", (fails, row["id"]))
    db.commit()
    return sent


def scheduler(db, lock, send, stop):
    while not stop.wait(60 - time.time() % 60):
        try:
            with lock:
                n = run_once(db, send)
            if n:
                log.info("%d rappel(s) envoyé(s)", n)
        except Exception:
            log.exception("ordonnanceur")


# --------------------------------------------------------------------------- HTTP
class RateLimiter:
    def __init__(self, per_minute=30):
        self.per_minute, self.hits, self.lock = per_minute, {}, threading.Lock()

    def ok(self, ip):
        minute = int(time.time() // 60)
        with self.lock:
            if len(self.hits) > 5000:
                self.hits.clear()
            m, n = self.hits.get(ip, (minute, 0))
            n = n + 1 if m == minute else 1
            self.hits[ip] = (minute, n)
            return n <= self.per_minute


def make_handler(db, lock, public_key, limiter):
    routes = {"/api/push/subscribe": upsert, "/api/push/activity": activity,
              "/api/push/unsubscribe": unsubscribe, "/api/push/resubscribe": resubscribe}

    class Handler(BaseHTTPRequestHandler):
        server_version = "xuehanyu-push"
        sys_version = ""

        def log_message(self, fmt, *args):
            log.debug(fmt, *args)

        def _json(self, code, obj):
            data = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _ip(self):
            return self.headers.get("X-Real-IP") or self.client_address[0]

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/api/push/key":
                return self._json(200, {"key": public_key})
            if path == "/api/push/health":
                with lock:
                    n = db.execute("SELECT COUNT(*) FROM subs").fetchone()[0]
                return self._json(200, {"ok": True, "subscribers": n})
            self._json(404, {"error": "not found"})

        def do_POST(self):
            handler = routes.get(urlparse(self.path).path)
            if not handler:
                return self._json(404, {"error": "not found"})
            if not limiter.ok(self._ip()):
                return self._json(429, {"error": "trop de requêtes"})
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = -1
            if not 0 < length <= MAX_BODY:
                return self._json(413, {"error": "corps invalide"})
            try:
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("objet attendu")
                with lock:
                    handler(db, body)
            except (ValueError, TypeError, json.JSONDecodeError) as e:
                return self._json(400, {"error": str(e)})
            self._json(200, {"ok": True})

    return Handler


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = Config.from_env()
    vapid, public_key = load_or_create_vapid(cfg.key_path)
    db, lock, stop = connect(cfg.db_path), threading.Lock(), threading.Event()
    threading.Thread(target=scheduler, args=(db, lock, default_sender(vapid, cfg.subject), stop), daemon=True).start()
    server = ThreadingHTTPServer((cfg.host, cfg.port), make_handler(db, lock, public_key, RateLimiter()))
    log.info("à l'écoute sur %s:%d", cfg.host, cfg.port)
    try:
        server.serve_forever()
    finally:
        stop.set()


if __name__ == "__main__":
    main()
