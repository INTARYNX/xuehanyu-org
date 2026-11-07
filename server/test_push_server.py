import base64
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer

import push_server as ps

FCM = "https://fcm.googleapis.com/fcm/send/abc123"


def body(**over):
    b = {"subscription": {"endpoint": FCM, "keys": {"p256dh": "BPkey", "auth": "authkey"}},
         "time": "19:00", "tz": "Europe/Paris", "lang": "fr", "day": "2026-11-07", "today": 0, "streak": 0}
    b.update(over)
    return b


def utc(y, mo, d, h, mi=0):
    return datetime(y, mo, d, h, mi, tzinfo=timezone.utc)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db = ps.connect(os.path.join(self.dir.name, "t.db"))

    def tearDown(self):
        self.db.close()
        self.dir.cleanup()

    def row(self):
        return self.db.execute("SELECT * FROM subs").fetchone()


class Validation(Base):
    def test_endpoint_allowlist(self):
        self.assertTrue(ps.valid_endpoint(FCM))
        self.assertTrue(ps.valid_endpoint("https://updates.push.services.mozilla.com/wpush/v2/x"))
        self.assertTrue(ps.valid_endpoint("https://web.push.apple.com/abc"))
        for bad in ["http://fcm.googleapis.com/x", "https://evil.example.com/x", "https://127.0.0.1/x",
                    "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x",
                    "https://169.254.169.254/latest/meta-data", "ftp://fcm.googleapis.com/x", ""]:
            self.assertFalse(ps.valid_endpoint(bad), bad)

    def test_time_tz_day(self):
        self.assertTrue(ps.valid_time("07:05") and ps.valid_time("23:59"))
        for bad in ["24:00", "7:05", "19:60", "ab:cd", None, 1900]:
            self.assertFalse(ps.valid_time(bad), bad)
        self.assertTrue(ps.valid_tz("Pacific/Auckland"))
        self.assertFalse(ps.valid_tz("Mars/Olympus"))
        self.assertTrue(ps.valid_day("2026-11-07"))
        self.assertFalse(ps.valid_day("2026-13-01"))

    def test_upsert_rejects_bad_input(self):
        bad_sub = {"endpoint": "https://evil.example.com/x", "keys": {"p256dh": "a", "auth": "b"}}
        for b in [body(time="99:99"), body(tz="Nope/Nope"), body(subscription=bad_sub),
                  body(subscription={"endpoint": FCM, "keys": {}}), body(subscription=None)]:
            with self.assertRaises(ValueError):
                ps.upsert(self.db, b)
        self.assertIsNone(self.row())


class Storage(Base):
    def test_upsert_is_idempotent_and_updates_settings(self):
        ps.upsert(self.db, body())
        ps.upsert(self.db, body(time="20:30", lang="en"))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM subs").fetchone()[0], 1)
        r = self.row()
        self.assertEqual((r["remind"], r["lang"]), ("20:30", "en"))

    def test_activity_only_counts_when_something_was_practised(self):
        ps.upsert(self.db, body())
        ps.activity(self.db, {"endpoint": FCM, "day": "2026-11-07", "today": 0, "streak": 3})
        self.assertIsNone(self.row()["last_active_day"])
        ps.activity(self.db, {"endpoint": FCM, "day": "2026-11-07", "today": 4, "streak": 3})
        self.assertEqual(self.row()["last_active_day"], "2026-11-07")

    def test_resubscribe_moves_settings_to_the_new_endpoint(self):
        ps.upsert(self.db, body(time="08:15", lang="en"))
        new = "https://fcm.googleapis.com/fcm/send/NEW"
        ps.resubscribe(self.db, {"old": FCM, "subscription": {"endpoint": new, "keys": {"p256dh": "k2", "auth": "a2"}}})
        r = self.row()
        self.assertEqual((r["endpoint"], r["remind"], r["lang"]), (new, "08:15", "en"))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM subs").fetchone()[0], 1)

    def test_unsubscribe(self):
        ps.upsert(self.db, body())
        ps.unsubscribe(self.db, {"endpoint": FCM})
        self.assertIsNone(self.row())


class Scheduling(Base):
    def setUp(self):
        super().setUp()
        ps.upsert(self.db, body())  # 19:00 Europe/Paris (UTC+1 en novembre) = 18:00 UTC

    def test_not_before_the_local_time(self):
        self.assertFalse(ps.due(self.row(), utc(2026, 11, 7, 17, 59)))
        self.assertTrue(ps.due(self.row(), utc(2026, 11, 7, 18, 0)))

    def test_uses_the_subscribers_timezone(self):
        ps.upsert(self.db, body(tz="America/New_York"))  # 19:00 EST = 00:00 UTC le lendemain
        self.assertFalse(ps.due(self.row(), utc(2026, 11, 7, 18, 0)))
        self.assertTrue(ps.due(self.row(), utc(2026, 11, 8, 0, 0)))

    def test_window_closes_after_an_outage(self):
        self.assertTrue(ps.due(self.row(), utc(2026, 11, 7, 20, 30)))
        self.assertFalse(ps.due(self.row(), utc(2026, 11, 7, 22, 0)))

    def test_skipped_when_already_practised_today(self):
        ps.activity(self.db, {"endpoint": FCM, "day": "2026-11-07", "today": 2, "streak": 1})
        self.assertFalse(ps.due(self.row(), utc(2026, 11, 7, 18, 30)))
        self.assertTrue(ps.due(self.row(), utc(2026, 11, 8, 18, 30)))

    def test_sent_once_per_local_day(self):
        sent = []
        send = lambda row, payload: sent.append(payload) or "ok"
        self.assertEqual(ps.run_once(self.db, send, utc(2026, 11, 7, 18, 0)), 1)
        self.assertEqual(ps.run_once(self.db, send, utc(2026, 11, 7, 18, 1)), 0)
        self.assertEqual(ps.run_once(self.db, send, utc(2026, 11, 8, 18, 0)), 1)
        self.assertEqual(len(sent), 2)

    def test_stops_after_two_weeks_without_practice(self):
        ps.activity(self.db, {"endpoint": FCM, "day": "2026-10-01", "today": 3, "streak": 1})
        self.assertTrue(ps.due(self.row(), utc(2026, 10, 15, 18, 0)))
        self.assertFalse(ps.due(self.row(), utc(2026, 10, 16, 18, 0)))

    def test_gone_subscription_is_deleted_and_failures_are_counted(self):
        ps.run_once(self.db, lambda r, p: "gone", utc(2026, 11, 7, 18, 0))
        self.assertIsNone(self.row())
        ps.upsert(self.db, body())
        for i in range(ps.MAX_FAILS - 1):
            ps.run_once(self.db, lambda r, p: "fail", utc(2026, 11, 7 + i, 18, 0))
        self.assertEqual(self.row()["fails"], ps.MAX_FAILS - 1)
        ps.run_once(self.db, lambda r, p: "fail", utc(2026, 11, 20, 18, 0))
        self.assertIsNone(self.row())

    def test_a_crashing_sender_does_not_stop_the_others(self):
        two = {"endpoint": "https://fcm.googleapis.com/fcm/send/two", "keys": {"p256dh": "k", "auth": "a"}}
        ps.upsert(self.db, body(subscription=two))
        calls = []

        def send(row, payload):
            calls.append(row["endpoint"])
            if row["endpoint"] == FCM:
                raise RuntimeError("boom")
            return "ok"

        self.assertEqual(ps.run_once(self.db, send, utc(2026, 11, 7, 18, 0)), 1)
        self.assertEqual(len(calls), 2)

    def test_message_mentions_the_streak_only_when_it_is_alive(self):
        ps.activity(self.db, {"endpoint": FCM, "day": "2026-11-07", "today": 5, "streak": 6})
        self.assertIn("6", ps.message_for(self.row(), utc(2026, 11, 8, 18, 0))["body"])
        self.assertNotIn("6", ps.message_for(self.row(), utc(2026, 11, 10, 18, 0))["body"])  # série cassée
        en = body(lang="en")
        del en["streak"]                                  # un changement de langue n'efface pas la série
        ps.upsert(self.db, en)
        self.assertIn("streak", ps.message_for(self.row(), utc(2026, 11, 8, 18, 0))["body"])


class Http(Base):
    def setUp(self):
        super().setUp()
        handler = ps.make_handler(self.db, threading.Lock(), "PUBKEY", ps.RateLimiter(100))
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_port}"

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        super().tearDown()

    def call(self, path, payload=None, raw=None):
        data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
        req = urllib.request.Request(self.base + path, data=data, method="POST" if data is not None else "GET",
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read()), r.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), e.headers

    def test_key_and_health(self):
        s, j, h = self.call("/api/push/key")
        self.assertEqual((s, j["key"], h["Cache-Control"]), (200, "PUBKEY", "no-store"))
        self.assertEqual(self.call("/api/push/health")[1], {"ok": True, "subscribers": 0})

    def test_subscribe_then_activity_then_unsubscribe(self):
        self.assertEqual(self.call("/api/push/subscribe", body())[0], 200)
        self.assertEqual(self.call("/api/push/activity",
                                   {"endpoint": FCM, "day": "2026-11-07", "today": 3, "streak": 2})[0], 200)
        self.assertEqual(self.row()["last_active_day"], "2026-11-07")
        self.assertEqual(self.call("/api/push/unsubscribe", {"endpoint": FCM})[0], 200)
        self.assertIsNone(self.row())

    def test_rejects_bad_requests(self):
        self.assertEqual(self.call("/api/push/subscribe", body(time="nope"))[0], 400)
        self.assertEqual(self.call("/api/push/subscribe", raw=b"not json")[0], 400)
        self.assertEqual(self.call("/api/push/subscribe", raw=b"[1,2]")[0], 400)
        self.assertEqual(self.call("/api/push/subscribe", raw=b"x" * (ps.MAX_BODY + 1))[0], 413)
        self.assertEqual(self.call("/api/push/nothing", {})[0], 404)

    def test_rate_limit(self):
        lim = ps.RateLimiter(3)
        self.assertEqual([lim.ok("1.1.1.1") for _ in range(5)], [True, True, True, False, False])
        self.assertTrue(lim.ok("2.2.2.2"))


class Vapid(unittest.TestCase):
    def test_key_is_created_once_and_is_a_valid_uncompressed_point(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            path = os.path.join(d, "sub", "vapid.pem")
            _, pub1 = ps.load_or_create_vapid(path)
            _, pub2 = ps.load_or_create_vapid(path)
            self.assertEqual(pub1, pub2)
            raw = base64.urlsafe_b64decode(pub1 + "=" * (-len(pub1) % 4))
            self.assertEqual((len(raw), raw[0]), (65, 4))


if __name__ == "__main__":
    unittest.main()
