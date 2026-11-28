#!/usr/bin/env python3
"""
End-to-end test of every ERP module, run against a local server in DEMO mode:

  NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= CRON_SECRET=e2e-secret PLACEMENT_WHATSAPP_GROUP_URL=https://chat.whatsapp.com/E2ETESTGROUP npx next dev -p 3100
  python3 scripts/e2e.py http://localhost:3100

Forms are submitted exactly as a browser without JavaScript would (Next.js server actions support
this), so every server action is exercised through real HTTP. Standard library only.
"""
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from html.parser import HTMLParser

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100").rstrip("/")
TODAY = (dt.datetime.utcnow() + dt.timedelta(hours=5, minutes=30)).date()
results = []


# ---------------------------------------------------------------- HTTP ----
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def http(method, path, cookie, body=None, headers=None):
    req = urllib.request.Request(BASE + path, data=body, method=method, headers={"cookie": cookie, **(headers or {})})
    try:
        r = OPENER.open(req, timeout=120)
        return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def get(path, cookie):
    for _ in range(5):  # follow redirects
        status, h, body = http("GET", path, cookie)
        if status in (301, 302, 303, 307, 308):
            path = re.sub(r"^https?://[^/]+", "", h.get("Location") or h.get("location"))
            continue
        return status, path, body.decode("utf-8", "replace")
    raise RuntimeError("redirect loop at " + path)


# ------------------------------------------------------------- forms ----
class Forms(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms, self.cur, self.sel, self.ta = [], None, None, None

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "form":
            self.cur = {"fields": [], "buttons": [], "selects": {}, "enctype": a.get("enctype", ""), "pos": self.getpos()}
            self.forms.append(self.cur)
        if self.cur is None:
            return
        if tag == "input":
            t = a.get("type", "text")
            if t in ("checkbox",):
                self.cur["fields"].append([a.get("name"), "on" if "checked" in a else None, "checkbox"])
            elif t == "radio":  # only the checked option is submitted
                if "checked" in a and a.get("name"):
                    self.cur["fields"].append([a.get("name"), a.get("value", "on"), "radio"])
            elif t == "file":
                self.cur["fields"].append([a.get("name"), None, "file"])
            elif t not in ("submit", "button") and a.get("name"):
                self.cur["fields"].append([a.get("name"), a.get("value", ""), t])
        elif tag == "select" and a.get("name"):
            self.sel = a["name"]
            self.cur["selects"][self.sel] = {"options": [], "value": None}
        elif tag == "option" and self.sel:
            o = self.cur["selects"][self.sel]
            o["options"].append(a.get("value", ""))
            if "selected" in a:
                o["value"] = a.get("value", "")
        elif tag == "textarea" and a.get("name"):
            self.ta = a["name"]
            self.cur["fields"].append([self.ta, "", "textarea"])
        elif tag == "button":
            self.cur["buttons"].append({"name": a.get("name"), "value": a.get("value", ""), "text": ""})
            self._btn = self.cur["buttons"][-1]

    def handle_data(self, d):
        if self.cur and getattr(self, "_btn", None) is not None:
            self._btn["text"] += d

    def handle_endtag(self, tag):
        if tag == "form":
            self.cur = None
        elif tag == "select":
            self.sel = None
        elif tag == "button":
            self._btn = None


def forms_of(html):
    p = Forms()
    p.feed(html)
    starts = [0]
    for line in html.split("\n"):
        starts.append(starts[-1] + len(line) + 1)
    for f in p.forms:
        f["names"] = {x[0] for x in f["fields"]} | set(f["selects"])
        f["start"] = starts[f["pos"][0] - 1] + f["pos"][1]  # character offset of <form> in the page
    return p.forms


def find_form(html, must=(), button=None, must_not=()):
    for f in forms_of(html):
        if all(m in f["names"] for m in must) and not any(m in f["names"] for m in must_not):
            if button is None or any(button.lower() in b["text"].lower() for b in f["buttons"]):
                return f
    raise AssertionError(f"form with {must} / button {button!r} not found")


def submit(path, cookie, form, values=None, button=None, files=None):
    """Post a parsed form like a JS-less browser. Returns (status, location, body)."""
    values, files = values or {}, files or {}
    parts = []
    for name, val, typ in form["fields"]:
        if not name or typ == "file":
            continue
        if name in values:
            continue
        if typ == "checkbox" and val is None:
            continue
        parts.append((name, val or ""))
    for name, sel in form["selects"].items():
        if name not in values:
            parts.append((name, sel["value"] if sel["value"] is not None else (sel["options"][0] if sel["options"] else "")))
    for k, v in values.items():
        if v is None:
            continue
        parts.append((k, v))
    if button:
        b = next(b for b in form["buttons"] if button.lower() in b["text"].lower())
        if b["name"]:
            parts.append((b["name"], b["value"]))
    boundary = "----e2e" + uuid.uuid4().hex
    body = b""
    for k, v in parts:
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (fname, ctype, data) in files.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    status, h, resp = http("POST", path, cookie, body, {"content-type": f"multipart/form-data; boundary={boundary}"})
    loc = h.get("Location") or h.get("location") or h.get("x-action-redirect") or ""
    return status, re.sub(r"^https?://[^/]+", "", loc.split(";")[0]), resp.decode("utf-8", "replace")


# ------------------------------------------------------------- checks ----
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  — {detail}" if detail and not ok else ""))


def text(html):
    html = re.sub(r"<script[\s\S]*?</script>", " ", html)  # drop the RSC payload, which repeats page text
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


ADMIN = "mvl_demo=admin"
# the biometric bridge key, if one is configured for the server under test
ENV = dict(l.split("=", 1) for l in open(".env.local").read().splitlines() if "=" in l and not l.startswith("#")) if __import__("os").path.exists(".env.local") else {}
BIO = {"content-type": "application/json", "x-api-key": ENV.get("BIOMETRIC_API_KEY", "").split("#")[0].strip()}

# 1. every staff page renders
for p in ["/dashboard", "/students", "/students/new", "/attendance", "/attendance/print", "/fees", "/validity", "/access",
          "/placements", "/documents", "/settings", "/students/s-001", "/students/s-001/edit", "/api/export/attendance"]:
    s, final, html = get(p, ADMIN)
    check(f"page {p}", s == 200 and "Application error" not in html and "Internal Server Error" not in html, f"status {s} at {final}")

# 2. admission
_, _, html = get("/students/new", ADMIN)
f = find_form(html, must=["full_name", "course_id"])
course = f["selects"]["course_id"]["options"][2]  # DV
s, loc, body = submit("/students/new", ADMIN, f, {
    "full_name": "E2E Student", "email": "e2e.student@example.com", "phone": "9111111111", "course_id": course,
    "total_fee": "30000", "alloc_amount_0": "20000", "alloc_amount_1": "10000", "alloc_n_0": "3", "alloc_n_1": "2",
})
new_id = (re.search(r"/students/([\w-]+)", loc) or [None, None])[1]
check("admission creates student", s in (303, 302, 307) and new_id and new_id != "new", f"status {s} loc {loc} {text(body)[:200]}")
SP = f"/students/{new_id}"
_, _, prof = get(SP, ADMIN)
t = text(prof)
check("admission: fee split into 5 installments", t.count("Mark paid") == 5, f"Mark paid x{t.count('Mark paid')}")
check("admission: all 5 access channels active", t.count("Active Block") == 5 or t.count("Block") >= 5)

# 3. edit profile (education, family, validity 30 days out -> expiry reminder)
_, _, html = get(SP + "/edit", ADMIN)
f = find_form(html, must=["full_name", "edu.0.institution"])
v30 = (TODAY + dt.timedelta(days=30)).isoformat()
s, loc, body = submit(SP + "/edit", ADMIN, f, {
    "dob": "2000-05-15", "blood_group": "O+", "languages": "English, Hindi, Telugu",
    "address.line": "12 MG Road", "address.city": "Hyderabad", "address.state": "Telangana", "address.pincode": "500001",
    "family.father_name": "E2E Father", "family.father_phone": "9222222222",
    "edu.2.institution": "JNTU Hyderabad", "edu.2.stream": "ECE", "edu.2.year": "2022", "edu.2.score": "8.1 CGPA",
    "pro.working_status": "Fresher", "pro.expected_ctc": "6 LPA", "pro.relocate": "on",
    "placement_eligible": "on", "placement_consent": "on", "validity_end": v30, "ref.biometric": "E2E-BIO-1",
})
check("edit profile saves", s in (303, 302, 307) and f"/students/{new_id}" in loc, f"status {s} loc {loc} {text(body)[:300]}")
_, _, prof = get(SP, ADMIN)
t = text(prof)
for needle in ["JNTU Hyderabad", "8.1 CGPA", "E2E Father", "Hyderabad", "English, Hindi, Telugu", "Eligible"]:
    check(f"profile shows '{needle}'", needle in t)

# 4. expiry job (daily cron) -> 30-day reminder recorded for this student
s, _, raw = http("POST", "/api/cron/expiry", "", headers={"authorization": "Bearer e2e-secret"})
data = json.loads(raw or b"{}")
check("cron expiry runs", s == 200 and data.get("ok"), raw[:200])
check("cron: 30-day reminder for edited student", any(p["student_id"] == new_id and p["kind"] == "expiry_30" for p in data.get("processed", [])), str(data.get("processed"))[:300])
check("cron: email delivery reported (no key => pending)", "delivery" in data and data["delivery"]["configured"] is False)
s, _, raw = http("POST", "/api/cron/expiry", "")
check("cron rejects missing secret", s == 401)

# 5. documents: upload, view, verify, delete
_, _, prof = get(SP, ADMIN)
f = find_form(prof, must=["kind"], button="Upload")
pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
s, loc, body = submit(SP, ADMIN, f, {"kind": "resume"}, files={"file": ("e2e resume.pdf", "application/pdf", pdf)})
check("upload resume", s in (200, 303), f"status {s}")
_, _, prof = get(SP, ADMIN)
doc = re.search(r'/api/documents/([\w-]+)', prof)
check("uploaded document listed", doc and "e2e_resume.pdf" in prof, "")
if doc:
    s, h, raw = http("GET", f"/api/documents/{doc[1]}", ADMIN)
    check("download returns the same PDF", s == 200 and raw == pdf, f"status {s} len {len(raw)}")
    s, _, _ = http("GET", f"/api/documents/{doc[1]}", "mvl_demo=student:s-003")
    check("another student cannot open it", s == 404, f"status {s}")
    s, _, _ = http("GET", f"/api/documents/{doc[1]}", "")
    check("signed-out visitor cannot open it", s in (401, 307), f"status {s}")
    f = find_form(prof, button="Verify")
    submit(SP, ADMIN, f, button="Verify")
    _, _, prof = get(SP, ADMIN)
    check("verify document", "Verified" in text(prof))
s, loc, body = submit(SP, ADMIN, find_form(prof, must=["kind"], button="Upload"), {"kind": "photo"}, files={"file": ("x.exe", "application/x-msdownload", b"MZ")})
check("rejects disallowed file type", "Upload a PDF, JPG, PNG, WEBP or Word file" in body, f"status {s}")

# 6. fees: payment with reference
_, _, html = get("/fees", ADMIN)
f = find_form(html, must=["installment_id", "reference"])
s, _, _ = submit("/fees", ADMIN, f, {"amount": "1000", "mode": "Cash", "reference": "E2E-TXN-1"})
_, _, html = get("/fees", ADMIN)
check("fees: payment with reference recorded", "E2E-TXN-1" in html, f"status {s}")

# 7. access: hold then activate
_, _, prof = get(SP, ADMIN)
submit(SP, ADMIN, find_form(prof, button="Put on hold"), button="Put on hold")
_, _, prof = get(SP, ADMIN)
check("hold blocks all channels", text(prof).count("Blocked") >= 5)
s, _, raw = http("POST", "/api/webhooks/biometric", "", json.dumps({"punches": [{"device_id": "D1", "user_code": "E2E-BIO-1", "timestamp": f"{TODAY}T04:00:00Z"}]}).encode(), BIO)
check("biometric punch rejected while on hold", s == 200 and b'"ok":false' in raw, raw[:200])
submit(SP, ADMIN, find_form(prof, button="Activate"), button="Activate")
_, _, prof = get(SP, ADMIN)
check("activate restores access", "Blocked" not in text(prof))
s, _, raw = http("POST", "/api/webhooks/biometric", "", json.dumps({"punches": [{"device_id": "D1", "user_code": "E2E-BIO-1", "timestamp": f"{TODAY}T04:00:00Z"}]}).encode(), BIO)
check("biometric punch accepted after activate (custom biometric ID)", b'"ok":true' in raw, raw[:200])

# 8. master data: add staff, edit course, add vendor (forms may live on Settings or their own pages)
def form_on(paths, must, must_not=()):
    for p in paths:
        st, final, html = get(p, ADMIN)
        if st != 200:
            continue
        try:
            return p, html, find_form(html, must=must, must_not=must_not)
        except AssertionError:
            continue
    raise AssertionError(f"no form with {must} on {paths}")

pg, html, f = form_on(["/hr", "/settings"], ["employee_code", "full_name"], must_not=["id"])
submit(pg, ADMIN, f, {"employee_code": "e2e9", "full_name": "E2E Staff", "designation": "Trainer", "monthly_salary": "50000"})
_, _, html = get(pg, ADMIN)
check(f"staff added ({pg})", "E2E9" in html.upper() and "E2E Staff" in html)
pg, html, f = form_on(["/courses", "/settings"], ["code", "fee", "id"])
submit(pg, ADMIN, f, {"fee": "31000"})
_, _, html = get(pg, ADMIN)
check(f"course fee edited ({pg})", 'value="31000"' in html)
pg, html, f = form_on(["/vendors", "/settings"], ["name", "contact_person"], must_not=["id", "parent_id"])
submit(pg, ADMIN, f, {"name": "E2E Vendor", "contact_person": "E2E Contact"})
_, _, html = get(pg, ADMIN)
check(f"vendor added ({pg})", "E2E Vendor" in html)

# 9. letters: staff payslip and student certificate
_, _, html = get("/documents?template=payslip", ADMIN)
f = find_form(html, must=["template", "subject"])
staff_opt = next(o for o in f["selects"]["subject"]["options"] if o.startswith("staff:"))
s, loc, _ = submit("/documents?template=payslip", ADMIN, f, {"subject": staff_opt, "d_month": TODAY.strftime("%Y-%m")})
check("letters: payslip issued", "/documents/MV-PAY-" in loc, f"loc {loc}")
if loc:
    _, _, html = get(loc, ADMIN)
    check("payslip renders net pay", "Net payable" in html)
_, _, html = get(f"/documents?template=training_certificate&subject=student:{new_id}", ADMIN)
s, loc, _ = submit("/documents", ADMIN, find_form(html, must=["template", "subject"]))
check("letters: certificate issued", "/documents/MV-CRT-" in loc, f"loc {loc}")
serial = loc.rsplit("/", 1)[-1]
_, _, html = get(f"/verify/{serial}", "")
check("public QR verification shows authentic", "Authentic document" in html and "E2E Student" in html)

# 10. placements: create drive, staff records yes, set stage
_, _, html = get("/placements", ADMIN)
f = find_form(html, must=["company", "job_role"])
s, loc, _ = submit("/placements", ADMIN, f, {"company": "E2E Corp", "job_role": "DV Engineer", "status": "open"})
drive = (re.search(r"drive=([\w-]+)", loc) or [None, None])[1]
check("placements: drive created", drive, f"loc {loc}")
_, _, html = get(f"/placements?drive={drive}", ADMIN)
def row_form(html, sid):
    for f in forms_of(html):
        if any(n == "student_id" and v == sid for n, v, _ in f["fields"]) and any(b["value"] == "yes" for b in f["buttons"]):
            return f
    raise AssertionError(f"no Yes/No row for {sid}")
check("placements: every eligible student has Yes/No buttons", sum(1 for f in forms_of(html) if any(b["value"] == "yes" for b in f["buttons"])) >= 5)
f = row_form(html, new_id)
s, _, _ = submit(f"/placements?drive={drive}", ADMIN, f, button="Yes")
_, _, html = get(f"/placements?drive={drive}", ADMIN)
check("placements: staff-recorded yes appears", "E2E Student" in html and "Synced" in html, "expected demo sheet sync")
f = find_form(html, must=["stage"])
submit(f"/placements?drive={drive}", ADMIN, f, {"stage": "Shortlisted"})
_, _, html = get(f"/placements?drive={drive}", ADMIN)
check("placements: stage updated", 'selected="">Shortlisted' in html or ">Shortlisted</option>" in html and 'value="Shortlisted" selected' in html or "Shortlisted" in text(html))

# 11. attendance presets
_, _, html = get("/attendance", ADMIN)
check("attendance: month presets present", "This month" in html and "Last month" in html)

# 12. student portal (demo persona s-002)
STU = "mvl_demo=student:s-002"
for p in ["/portal", "/portal/drives", "/portal/documents", "/portal/account"]:
    s, final, html = get(p, STU)
    check(f"portal page {p}", s == 200 and final == p and "Application error" not in html, f"status {s} at {final}")
s, final, _ = get("/dashboard", STU)
check("student is kept out of admin pages", final.startswith("/portal"), final)
_, _, html = get("/portal/drives", STU)
f = find_form(html, button="Yes, interested")
s, _, _ = submit("/portal/drives", STU, f, button="Yes, interested")
_, _, html = get("/portal/drives", STU)
check("portal: student says yes to a drive", "Stage:" in text(html))
_, _, html = get("/portal/documents", STU)
s, _, body = submit("/portal/documents", STU, find_form(html, must=["kind"], button="Upload"), {"kind": "certificate"},
                    files={"file": ("cert.png", "image/png", b"\x89PNG\r\n\x1a\n" + b"0" * 64)})
_, _, html = get("/portal/documents", STU)
check("portal: student uploads a certificate", "cert.png" in html and "Awaiting verification" in html)
_, _, html = get("/manifest.webmanifest", "")
check("installable app manifest served", '"display":"standalone"' in html.replace(" ", ""))

# 13. every letter template (7 student + 4 staff)
TEMPLATES = ["admission_confirmation", "student_id_card", "visiting_card", "internship_offer", "internship_completion",
             "training_certificate", "placement_confirmation", "staff_offer", "payslip", "service_agreement", "experience_letter"]
for tpl in TEMPLATES:
    _, _, html = get(f"/documents?template={tpl}", ADMIN)
    f = find_form(html, must=["template", "subject"])
    opts = f["selects"]["subject"]["options"]
    subject = next(o for o in opts if o.startswith("staff:")) if tpl in ("staff_offer", "payslip", "service_agreement", "experience_letter") else f"student:{new_id}"
    vals = {"subject": subject}
    for name, _, typ in f["fields"]:
        if name and name.startswith("d_"):
            vals[name] = {"date": "2026-12-01", "month": "2026-11", "number": "1000"}.get(typ, "Sample value")
    s, loc, _ = submit("/documents", ADMIN, f, vals)
    ok = "/documents/MV-" in loc
    if ok:
        st, _, html = get(loc, ADMIN)
        ok = st == 200 and ("E2E Student" in html or "E2E Staff" in html)
    check(f"letter template {tpl}", ok, f"loc {loc}")

# 14. Zoom + TeamViewer feeds for the new student
import hashlib, hmac, time
enroll = re.search(r"MVL\d+", text(get(SP, ADMIN)[2]))[0]
ZSEC = ENV.get("ZOOM_WEBHOOK_SECRET", "").split("#")[0].strip()
def zoom(event, email, uuid_, topic="Regular Meeting", name=None):
    now = dt.datetime.utcnow()
    body = json.dumps({"event": event, "payload": {"object": {"uuid": uuid_, "topic": topic, "participant": {"email": email, "user_name": name,
           "join_time": (now - dt.timedelta(minutes=95)).strftime("%Y-%m-%dT%H:%M:%SZ"), "leave_time": now.strftime("%Y-%m-%dT%H:%M:%SZ")}}}}).encode()
    ts = str(int(time.time()))
    sig = "v0=" + hmac.new(ZSEC.encode(), f"v0:{ts}:".encode() + body, hashlib.sha256).hexdigest()
    return http("POST", "/api/webhooks/zoom", "", body, {"content-type": "application/json", "x-zm-request-timestamp": ts, "x-zm-signature": sig})
s, _, raw = http("POST", "/api/webhooks/zoom", "", json.dumps({"event": "endpoint.url_validation", "payload": {"plainToken": "tok"}}).encode(), {"content-type": "application/json"})
check("zoom URL validation token correct", json.loads(raw).get("encryptedToken") == hmac.new(ZSEC.encode(), b"tok", hashlib.sha256).hexdigest())
s1, _, r1 = zoom("meeting.participant_joined", "e2e.student@example.com", "e2e-meet")
s2, _, r2 = zoom("meeting.participant_left", "e2e.student@example.com", "e2e-meet")
check("zoom join+leave recorded", s1 == 200 and s2 == 200 and b'"ok":true' in r2, (r1 + r2)[:200])
s, _, raw = http("POST", "/api/webhooks/zoom", "", b'{"event":"meeting.participant_joined","payload":{}}', {"content-type": "application/json", "x-zm-request-timestamp": str(int(time.time())), "x-zm-signature": "v0=bad"})
check("zoom forged signature rejected", s == 401)
s, _, raw = zoom("meeting.participant_joined", "e2e.student@example.com", "e2e-other", topic="Weekly staff sync")
check("zoom: only 'Regular Meeting' counts for attendance", s == 200 and b"not an attendance meeting" in raw, raw[:200])
s, _, raw = zoom("meeting.participant_joined", "", "e2e-regular-2", topic="  regular   MEETING ", name=f"{enroll} E2E")
check("zoom: meeting name match ignores case/spaces; student matched by enrollment no. in Zoom name", s == 200 and b'"ok":true' in raw, raw[:200])
s, _, raw = zoom("meeting.participant_joined", "", "e2e-regular-3", name="E2E Student")
check("zoom: student matched by exact full name when no email", s == 200 and b'"ok":true' in raw, raw[:200])
s, _, raw = zoom("meeting.participant_joined", "", "e2e-regular-4", name="Somebody Unknown")
check("zoom: unknown participant ignored", s == 200 and b"unknown participant" in raw, raw[:200])
TV = {"content-type": "application/json", "x-api-key": ENV.get("TEAMVIEWER_API_KEY", "").split("#")[0].strip()}
s, _, raw = http("POST", "/api/webhooks/teamviewer", "", json.dumps({"student_ref": enroll, "recording_id": "rec-e2e", "watched_minutes": 42}).encode(), TV)
check("teamviewer recording recorded", s == 200 and b'"ok":true' in raw, raw[:200])
s, _, raw = http("POST", "/api/webhooks/teamviewer", "", b'{"student_ref":"x","recording_id":"r","watched_minutes":1}', {"content-type": "application/json", "x-api-key": "wrong"})
check("teamviewer wrong key rejected", s == 401)
_, _, csv = get(f"/api/export/attendance?from={TODAY - dt.timedelta(days=1)}&to={TODAY}", ADMIN)
rows = [l for l in csv.splitlines() if "E2E Student" in l]
check("CSV export: IST headers and all 3 sources for new student",
      "Check-in (IST)" in csv and {"zoom", "teamviewer", "biometric"} <= {src for l in rows for src in ("zoom", "teamviewer", "biometric") if f'"{src}"' in l}, f"{len(rows)} rows")
_, _, prof = get(SP, ADMIN)
check("profile attendance counts all 3 sources", re.search(r"Zoom [1-9]", text(prof)) and re.search(r"TeamViewer [1-9]", text(prof)) and re.search(r"Biometric [1-9]", text(prof)))

# 15. block a single channel
submit(SP, ADMIN, find_form(prof, button="Block"), button="Block")  # first channel listed = Zoom
s, _, raw = zoom("meeting.participant_joined", "e2e.student@example.com", "e2e-meet-2")
check("blocked Zoom: join refused", s == 403, raw[:200])
s, _, raw = http("POST", "/api/webhooks/teamviewer", "", json.dumps({"student_ref": enroll, "recording_id": "rec-e2e-2", "watched_minutes": 10}).encode(), TV)
check("blocked Zoom: recordings still allowed", s == 200, raw[:200])
_, _, prof = get(SP, ADMIN)
submit(SP, ADMIN, find_form(prof, button="Allow"), button="Allow")
s, _, _ = zoom("meeting.participant_joined", "e2e.student@example.com", "e2e-meet-3")
check("Zoom allowed again", s == 200)

# 16. expiry: past end date -> auto-expired, everything blocked, portal blocked; renewal restores
_, _, html = get(SP + "/edit", ADMIN)
f = find_form(html, must=["full_name", "edu.0.institution"])
submit(SP + "/edit", ADMIN, f, {"validity_end": (TODAY - dt.timedelta(days=1)).isoformat()})
s, _, raw = http("POST", "/api/cron/expiry", "", headers={"authorization": "Bearer e2e-secret"})
check("cron expires student past end date", any(p["student_id"] == new_id and p["kind"] == "expired" for p in json.loads(raw)["processed"]), raw[:300])
_, _, prof = get(SP, ADMIN)
t = text(prof)
check("expired: status Expired and all 5 channels blocked", "Expired" in t and t.count("Blocked") >= 5)
s, _, raw = http("POST", "/api/webhooks/biometric", "", json.dumps({"punches": [{"device_id": "D1", "user_code": "E2E-BIO-1", "timestamp": f"{TODAY}T05:00:00Z"}]}).encode(), BIO)
check("expired: biometric refused", b'"ok":false' in raw, raw[:200])
NEW = f"mvl_demo=student:{new_id}"
s, final, html = get("/portal", NEW)
check("expired: Alumni Profile opens automatically on the next login", final.startswith("/portal/alumni") and "Alumni Profile" in text(html), final)
check("expired: Alumni Profile appears in the menu", 'href="/portal/alumni"' in html)
f = find_form(html, must=["company", "designation", "hiring"])
s, loc, _ = submit("/portal/alumni", NEW, f, {"company": "E2E Silicon Pvt Ltd", "designation": "DV Engineer", "participation": "Mock interviews", "chg.0.company": "E2E First Co"})
check("expired: alumni profile saved", "saved=" in (loc or ""), loc)
_, final, html = get("/portal", NEW)
check("expired: dashboard opens once the alumni profile is filled", final == "/portal", final)
check("expired: portal shows paused notice", "paused" in text(html) and "expired" in text(html).lower())
_, _, html = get("/portal/drives", NEW)
check("expired: portal placement applications unavailable", "blocked" in text(html).lower() or "not active" in text(html).lower())
_, _, html = get("/portal", NEW)
check("portal notices list the expiry", "has expired" in text(html) or "expires in" in text(html))
submit(SP, ADMIN, find_form(prof, button="Renew +6 months"), button="Renew +6 months")
_, _, prof = get(SP, ADMIN)
t = text(prof)
check("renewal: active again with a future end date", "Active" in t and "Blocked" not in t and "Valid till" in t)
_, _, html = get("/portal", NEW)
check("renewal: Alumni Profile hidden again while training is valid", 'href="/portal/alumni"' not in html)
check("renewal: alumni history kept", "E2E Silicon Pvt Ltd" in get("/portal/alumni", NEW)[2] or "opens after your training validity ends" in text(get("/portal/alumni", NEW)[2]))

# 17. drive status: closed drives disappear from the portal
_, _, html = get(f"/placements?drive={drive}", ADMIN)
submit(f"/placements?drive={drive}", ADMIN, find_form(html, button="Mark closed"), button="Mark closed")
_, _, html = get("/portal/drives", STU)
check("closed drive hidden from students", "E2E Corp" not in html)
_, _, html = get(f"/placements?drive={drive}", ADMIN)
submit(f"/placements?drive={drive}", ADMIN, find_form(html, button="Mark open"), button="Mark open")
_, _, html = get("/portal/drives", STU)
check("re-opened drive visible to students", "E2E Corp" in html)

# 18. portal account page
_, _, html = get("/portal/account", NEW)
s, _, body = submit("/portal/account", NEW, find_form(html, must=["password", "confirm"]), {"password": "short", "confirm": "short"})
check("password change validates length", "at least 8 characters" in body)

# 19. college / corporate admissions with full college / company details (new entries go to the masters)
ORG = {
    "college": {"college_name": "E2E Engineering College", "college_city": "Mysuru", "college_state": "Karnataka"},
    "corporate": {"company_name": "E2E Silicon Pvt Ltd", "company_city": "Bengaluru", "company_state": "Karnataka", "company_designation": "DV Engineer",
                  "hr_rows": "0,1", "hr.0.name": "E2E HR One", "hr.0.designation": "HR Manager", "hr.0.email": "hr1@e2e-silicon.example", "hr.0.phone": "+919000000001",
                  "hr.1.name": "E2E HR Two", "hr.1.email": "hr2@e2e-silicon.example"},
}
org_ids = {}
for cat in ["college", "corporate"]:
    _, _, html = get("/students/new", ADMIN)
    f = find_form(html, must=["full_name", "course_id"])
    vals = {"full_name": f"E2E {cat.title()} Student", "category": cat, "course_id": f["selects"]["course_id"]["options"][0], **ORG[cat]}
    s, loc, body = submit("/students/new", ADMIN, f, vals)
    org_ids[cat] = (re.search(r"/students/([\w-]+)", loc) or [None, None])[1]
    check(f"admission as {cat} student with new {cat} details", s in (302, 303, 307) and org_ids[cat] and org_ids[cat] != "new", f"status {s} loc {loc} {text(body)[:200]}")
_, _, html = get("/students/new", ADMIN)
f = find_form(html, must=["full_name", "course_id"])
s, loc, body = submit("/students/new", ADMIN, f, {"full_name": "E2E No City", "category": "college", "course_id": f["selects"]["course_id"]["options"][0], "college_name": "E2E Engineering College"})
check("college admission requires city and state", s == 500 or "city and state" in body.lower(), f"status {s}")
_, _, html = get("/hr-contacts", ADMIN)
check("company HR contacts saved to HR master", "E2E HR One" in html and "E2E HR Two" in html)
_, _, html = get(f"/students/{org_ids['corporate']}", ADMIN)
check("corporate student keeps designation", "DV Engineer" in text(html) or "DV Engineer" in html)
_, _, html = get("/colleges", ADMIN)
check("new college appears in College Master", "E2E Engineering College" in html)
_, _, html = get("/students/new", ADMIN)
check("new college offered on the next admission", "E2E Engineering College" in html)

# 20. full logo everywhere
for p, ck in [("/login", ""), ("/dashboard", ADMIN), (f"/documents/{serial}", ADMIN), ("/verify/" + serial, "")]:
    _, _, html = get(p, ck)
    check(f"full logo on {p.split('/')[1] or 'login'}", "logo-official.png" in html)
s, h, raw = http("GET", "/logo-official.png", "")
check("official logo image is served", s == 200 and raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) > 20000)

# 21. finance & fund flow (admin only)
def money(txt):
    return int(re.sub(r"[^\d-]", "", txt) or 0)

for p in ["/finance", "/finance/income", "/finance/income?entity=enrich", "/finance/income?entity=property", "/finance/tenants", "/finance/tenants/tcy-3",
          "/finance/expenses", "/finance/expenses?view=utilities", "/finance/expenses?view=property", "/finance/pay", "/finance/receivables",
          "/finance/accounts", "/finance/budgets", "/finance/reports"] + [f"/finance/tenants/tcy-3?tab={t}" for t in ["agreement", "rent", "utilities", "maintenance", "deposit", "documents", "history"]]:
    s, final, html = get(p, ADMIN)
    check(f"finance page {p}", s == 200 and "Application error" not in html and "Internal Server Error" not in html, f"status {s} at {final}")
for t in ["pnl", "income", "expenses", "receivables"]:
    s, h, raw = http("GET", f"/api/export/finance?type={t}", ADMIN)
    check(f"finance export {t}", s == 200 and raw.startswith(b"\xef\xbb\xbf"), f"status {s}")
s, final, _ = get("/finance", STU)
check("students cannot open finance", not final.startswith("/finance"), final)
s, _, _ = http("GET", "/api/export/finance?type=pnl", STU)
check("students cannot export finance", s == 403, f"status {s}")
_, _, html = get("/dashboard", STU)
check("finance menu hidden from students", "Finance Dashboard" not in html)
_, _, html = get("/finance", ADMIN)
t = text(html)
check("dashboard shows multi-source example", "Payment completed" in t and "ABC Electricals" in t)
check("dashboard shows entity P&L and cash flow", "Entity-wise P" in t and "Cash flow trend" in t)

# add a tenant to the vacant Home 06 with a deposit
_, _, html = get("/finance/tenants", ADMIN)
f = find_form(html, must=["unit_id", "monthly_rent", "full_name"])
s, loc, body = submit("/finance/tenants", ADMIN, f, {"full_name": "E2E Tenant", "phone": "9000011111", "start_date": TODAY.isoformat(), "monthly_rent": "14000",
                                                     "due_day": "5", "maintenance_charge": "1000", "security_deposit": "42000", "deposit_received": "42000", "deposit_account": "account:acc-pr-sbi"})
tid = (re.search(r"/finance/tenants/([\w-]+)", loc) or [None, None])[1]
check("add tenant", tid, f"status {s} loc {loc} {text(body)[:200]}")
TP = f"/finance/tenants/{tid}"
_, _, html = get(TP, ADMIN)
t = text(html)
check("tenant: deposit held 42,000 and this month's due raised", "₹42,000" in t and "₹15,000" in t, t[:300])
_, _, html = get("/finance/tenants", ADMIN)
check("Home 06 no longer vacant", "E2E Tenant" in html and "Add tenant" in html)

# utility bill paid by tenant goes onto this month's due; then pay it all
_, _, html = get(TP + "?tab=utilities", ADMIN)
submit(TP + "?tab=utilities", ADMIN, find_form(html, must=["utility", "bill_month", "amount"]), {"utility": "electricity", "bill_month": TODAY.strftime("%Y-%m"), "amount": "850", "prev_reading": "100", "curr_reading": "185", "payer": "tenant"})
_, _, html = get(TP + "?tab=rent", ADMIN)
check("tenant utility added to this month's due", "₹15,850" in text(html))
f = find_form(html, must=["kind", "amount", "paid_on"])
s, _, body = submit(TP + "?tab=rent", ADMIN, f, {"kind": "rent", "amount": "15850", "mode": "UPI", "reference": "E2E-RENT-1", "account": ""})
_, _, html = get(TP, ADMIN)
check("rent payment clears the due (outstanding ₹0)", re.search(r"Outstanding\s*₹0", text(html)) is not None, text(html)[:400])

# maintenance completed at owner's cost becomes a property expense
_, _, html = get(TP + "?tab=maintenance", ADMIN)
submit(TP + "?tab=maintenance", ADMIN, find_form(html, must=["title", "priority"]), {"title": "E2E tap repair", "priority": "high"})
_, _, html = get(TP + "?tab=maintenance", ADMIN)
f = find_form(html, must=["status", "cost", "charge_to"])
submit(TP + "?tab=maintenance", ADMIN, f, {"status": "completed", "cost": "1800", "charge_to": "owner"})
_, _, html = get("/finance/expenses?view=property", ADMIN)
check("maintenance cost booked as property expense", "Maintenance: E2E tap repair" in html)

# expenses: small one approved straight away; seeded ₹3,20,000 bill approved by super admin
_, _, html = get("/finance/expenses", ADMIN)
s, _, body = submit("/finance/expenses", ADMIN, find_form(html, must=["entity", "category", "description", "amount"]),
                    {"entity": "property", "category": "Water", "description": "E2E water tanker", "amount": "3000", "payee": "E2E Water Co"})
check("small expense saved as approved", "Expense saved." in body, text(body)[:200])
_, _, html = get("/finance/budgets", ADMIN)
f = find_form(html, button="Approve")
submit("/finance/budgets", ADMIN, f, button="Approve")
_, _, html = get("/finance/budgets", ADMIN)
check("super admin approves bill from queue", "Nothing waiting for approval" in html)

# multi-source payment for the E2E water bill (property): part from MasterVLSI bank -> settlement
_, _, html = get("/finance/pay", ADMIN)
f = find_form(html, must=["expense_id", "payee", "src_0", "amt_0"])
water = re.search(r'<option value="([\w-]+)">E2E water tanker', html)
check("unpaid bill offered for payment", water)
s, _, body = submit("/finance/pay", ADMIN, f, {"expense_id": water[1], "payee": "E2E Water Co", "paid_on": TODAY.isoformat(), "reference": "E2E-PAY-1",
                                              "src_0": "account:acc-mv-icici", "amt_0": "2000", "src_1": "pool:rent", "amt_1": "1000"})
check("multi-source payment succeeds and records a settlement", "Paid ₹3,000 to E2E Water Co" in body and "inter-entity settlement" in body, text(body)[:300])
_, _, html = get("/finance/pay", ADMIN)
check("new settlement property -> MasterVLSI ₹2,000 pending", re.search(r"₹2,000[\s\S]{0,400}E2E Water Co", html) is not None)
_, _, html = get("/finance/expenses?view=property", ADMIN)
check("paid bill marked paid", re.search(r"E2E water tanker[\s\S]{0,600}Paid", html) is not None)

# overdraft protection
_, _, html = get("/finance/pay", ADMIN)
s, _, body = submit("/finance/pay", ADMIN, find_form(html, must=["from_ref", "to_ref", "amount"]), {"from_ref": "pool:rent", "to_ref": "account:acc-pr-sbi", "amount": "99999999", "transfer_date": TODAY.isoformat()})
check("transfer larger than balance refused", "Not enough balance" in body, text(body)[:200])
_, _, html = get("/finance/accounts?ref=account:acc-pr-sbi", ADMIN)
before = re.search(r"Property — SBI savings[\s\S]{0,800}?(₹[\d,]+)", html)
s, _, body = submit("/finance/pay", ADMIN, find_form(get("/finance/pay", ADMIN)[2], must=["from_ref", "to_ref", "amount"]), {"from_ref": "pool:rent", "to_ref": "account:acc-pr-sbi", "amount": "1000", "transfer_date": TODAY.isoformat(), "reference": "E2E-DEP"})
check("transfer recorded", "Transfer recorded." in body, text(body)[:200])
_, _, html = get("/finance/accounts?ref=account:acc-pr-sbi", ADMIN)
after = re.search(r"Property — SBI savings[\s\S]{0,800}?(₹[\d,]+)", html)
check("account balance went up by ₹1,000", before and after and money(after[1]) - money(before[1]) == 1000, f"{before and before[1]} -> {after and after[1]}")
check("statement lists the transfer", "Transfer in from Rent collections" in html)

# settle the seeded MasterVLSI -> Property ₹20,000
_, _, html = get("/finance/pay", ADMIN)
forms = [f for f in forms_of(html) if "from_ref" in f["names"] and "date" in f["names"]]
pending_before = len(forms)
s, _, body = submit("/finance/pay", ADMIN, forms[-1])
_, _, html = get("/finance/pay", ADMIN)
check("settlement settled", "Settled." in body and len([f for f in forms_of(html) if "from_ref" in f["names"] and "date" in f["names"]]) == pending_before - 1, text(body)[:200])

# recurring: add one due today and create the bill
_, _, html = get("/finance/expenses", ADMIN)
f = find_form(html, must=["description", "frequency", "next_due"], must_not=["id"])
submit("/finance/expenses", ADMIN, f, {"entity": "enrich", "category": "Internet & phone", "description": "E2E broadband", "amount": "999", "frequency": "monthly", "next_due": TODAY.isoformat()})
_, _, html = get("/finance/expenses", ADMIN)
submit("/finance/expenses", ADMIN, find_form(html, button="Create bills that are due now"), button="Create bills that are due now")
_, _, html = get("/finance/expenses?view=company", ADMIN)
check("recurring payment turned into a bill", "E2E broadband" in html and "Recurring" in html)

# budget and other income
_, _, html = get("/finance/budgets", ADMIN)
submit("/finance/budgets", ADMIN, find_form(html, must=["entity", "category", "amount", "month"], must_not=["id"]), {"entity": "property", "category": "Water", "amount": "10000"})
_, _, html = get("/finance/budgets", ADMIN)
check("budget vs actual shows water budget", re.search(r"Water[\s\S]{0,200}₹10,000", html) is not None)
_, _, html = get("/finance/income?entity=enrich", ADMIN)
s, _, body = submit("/finance/income?entity=enrich", ADMIN, find_form(html, must=["entity", "amount", "category"]), {"amount": "55000", "category": "Consulting", "note": "E2E consulting", "account": "account:acc-es-hdfc"})
_, _, html = get("/finance/income?entity=enrich", ADMIN)
check("other income recorded for Enrich", "E2E consulting" in html)

# exit: refund = deposit − deductions − unpaid
_, _, html = get(TP + "?tab=deposit", ADMIN)
s, _, body = submit(TP + "?tab=deposit", ADMIN, find_form(html, must=["exit_date", "deductions", "refund_ref"]), {"exit_date": TODAY.isoformat(), "deductions": "2000", "refund_ref": "account:acc-pr-sbi"})
check("exit & settlement refunds ₹40,000", "Refund ₹40,000" in body, text(body)[:300])
_, _, html = get("/finance/tenants", ADMIN)
check("home vacant again after exit", re.search(r"Home 06[\s\S]{0,200}Vacant", html) is not None)

# daily job raises dues and recurring bills
s, _, raw = http("POST", "/api/cron/expiry", "", headers={"authorization": "Bearer e2e-secret"})
data = json.loads(raw or b"{}")
check("daily job includes finance", "finance" in data and "rent_dues_raised" in data["finance"], str(data.get("finance")))
_, _, html = get("/finance/tenants/tcy-3", ADMIN)
check("daily job doesn't backdate rent arrears before the tenancy was added", re.search(r"Outstanding\s*₹0", text(html)) is not None, re.search(r"Outstanding\s*\S+", text(html)) and re.search(r"Outstanding\s*\S+", text(html))[0])

# 22. training certificate carries the training start and end dates
_, _, html = get(f"/documents?template=training_certificate&subject=student:{new_id}", ADMIN)
f = find_form(html, must=["template", "subject", "d_start", "d_end"])
s, loc, _ = submit("/documents", ADMIN, f, {"d_start": "2026-06-01", "d_end": "2026-11-30", "d_grade": "A"})
_, _, html = get(loc, ADMIN)
check("training certificate shows from/to dates", "/documents/MV-CRT-" in loc and re.search(r"from\s*01 Jun 2026\s*to\s*30 Nov 2026", text(html)) is not None, text(html)[:300])

# 23. drive sheet download, "No" answer, ambassador rewards, per-student report
s, h, raw = http("GET", f"/api/export/drive?drive={drive}", ADMIN)
check("drive sheet downloads as Excel with the student", s == 200 and b"E2E Student" in raw and b"Enrollment No" in raw, f"status {s}")
_, _, html = get(f"/placements?drive={drive}", ADMIN)
other = next(f for f in forms_of(html) if any(b["value"] == "no" for b in f["buttons"]) and not any(v == new_id for _, v, _ in f["fields"]))
submit(f"/placements?drive={drive}", ADMIN, other, button="No")
_, _, html = get(f"/placements?drive={drive}", ADMIN)
check("staff can record a No answer", re.search(r'aria-pressed="true"[^>]*value="no"|value="no"[^>]*aria-pressed="true"', html) is not None)
for kind, expect in [("referral", "₹2,000")]:
    _, _, html = get("/ambassadors?show=all", ADMIN)
    f = find_form(html, must=["student_id", "kind", "details"])
    submit("/ambassadors?show=all", ADMIN, f, {"kind": kind, "details": f"E2E amb {kind}", "reward_amount": ""})
    _, _, html = get("/ambassadors?show=all", ADMIN)
    row = re.search(r"E2E amb " + kind + r"[\s\S]{0,300}?(₹[\d,]+)", html)
    check(f"ambassador {kind}: blank reward uses standard {expect}", row and row[1] == expect, row and row[1])
check("ambassador counters include all activity types", re.search(r"\d+ referral · \d+ institute feedback · \d+ google review · \d+ like / share / subscribe · \d+ mentorship · \d+ incident report", text(get("/ambassadors", ADMIN)[2])) is not None)
s, final, html = get(f"/students/{new_id}/report", ADMIN)
t = text(html)
check("per-student report renders", s == 200 and "Student Report" in t and "E2E Student" in t and "Attendance (last 90 days)" in t and "Fees" in t, f"status {s}")
_, _, html = get("/students", ADMIN)
check("students list links each report", f"/students/{new_id}/report" in html)
_, _, html = get(f"/students/{new_id}", ADMIN)
check("profile has Download report", "Download report" in html)

# 24. students see upcoming drives on their dashboard, and saving an answer confirms it
_, _, html = get("/portal", STU)
check("student dashboard lists upcoming drives", "Upcoming company drives" in html and "Wipro" in html)
_, _, html = get("/portal/drives", STU)
f = find_form(html, button="No")
s, loc, body = submit("/portal/drives", STU, f, button="No")
_, final, html = get(loc or "/portal/drives", STU)
check("student answer confirmed on screen", "Saved" in text(html), f"{s} {loc}")

# 25. enhanced profile: vertical education with dropdowns, address, WhatsApp, access IDs, before/after, college contacts
CS = f"/students/{org_ids['college']}"
_, _, html = get(CS + "/edit", ADMIN)
check("edit page offers board / university / stream lists", "State Board (Karnataka)" in html and "VTU" in html and "Science (PCM)" in html)
check("edit page has all states and union territories", "Ladakh" in html and "Puducherry" in html and "Telangana" in html)
f = find_form(html, must=["full_name", "edu.0.board"])
s, loc, body = submit(CS + "/edit", ADMIN, f, {
    "edu.0.board": "State Board (Karnataka)", "edu.0.institution": "E2E High School", "edu.0.start": "2015", "edu.0.end": "2016", "edu.0.year": "2016", "edu.0.score": "92%", "edu.0.state": "Karnataka",
    "edu.2.board": "VTU", "edu.2.stream": "ECE", "edu.2.institution": "E2E Engineering College", "edu.2.start": "2018", "edu.2.end": "2022", "edu.2.year": "2022", "edu.2.score": "8.4", "edu.2.state": "Karnataka",
    "phone": "9000099999", "extra.phone_whatsapp": "on", "address.line": "1 Lake Road", "address.city": "Mysuru", "address.state": "Karnataka",
    "extra.current_same": None, "current.line": "22 PG Hostel", "current.city": "Bengaluru", "current.state": "Karnataka",
    "ref.zoom": "e2e.zoom@example.com", "ref.biometric": "E2E-BIO-77", "ref.teamviewer": "TV-E2E-1",
    "pro.working_status": "Working", "pro.company": "ABC Technologies", "before.designation": "Graduate Engineer", "before.from": "2024-07", "before.to": "2026-01", "before.location": "Bengaluru",
    "after.status": "Placed", "after.company": "Meta", "after.designation": "Design Engineer", "after.package": "50 LPA", "after.doj": "2026-12-07", "after.hr_name": "John Mathew", "after.hr_email": "john@example.com", "after.location": "Bengaluru",
    "contact.0.position": "TPO", "contact.0.name": "Mr Suresh", "contact.0.phone": "9988776655", "contact.0.email": "tpo@college.example",
    "contact.1.position": "HOD", "contact.1.name": "Dr Anil Kumar", "contact.1.phone": "9876543210",
})
check("enhanced profile saves", s in (302, 303, 307) and "saved=1" in loc, f"status {s} loc {loc} {text(body)[:300]}")
_, _, html = get(loc or CS, ADMIN)
t = text(html)
for needle in ["State Board (Karnataka)", "2015 – 2016", "VTU", "8.4", "22 PG Hostel", "WhatsApp", "e2e.zoom@example.com", "E2E-BIO-77", "TV-E2E-1",
               "Graduate Engineer", "2024-07 – 2026-01", "Meta", "50 LPA", "John Mathew", "Mr Suresh", "Dr Anil Kumar", "Profile saved"]:
    check(f"profile shows {needle!r}", needle in t)
_, _, html = get(CS + "/edit", ADMIN)
check("college contacts reload into the form", 'value="Mr Suresh"' in html and 'value="Dr Anil Kumar"' in html)

# applications & interview tracking, notes, verification
_, _, html = get(CS, ADMIN)
f = find_form(html, must=["company", "rounds", "hr_email"], must_not=["id"])
submit(CS, ADMIN, f, {"company": "E2E Intel", "role": "DV Engineer", "rounds": "3", "status": "shortlisted", "package": "18 LPA", "hr_name": "E2E HR", "job_location": "Bengaluru"})
_, _, html = get(CS, ADMIN)
check("application added", "E2E Intel" in html and "Shortlisted" in text(html) and "18 LPA" in html)
f = next(ff for ff in forms_of(html) if "id" in ff["names"] and "rounds" in ff["names"])
submit(CS, ADMIN, f, {"status": "placed", "rounds": "4"})
_, _, html = get(CS, ADMIN)
check("application status updated", re.search(r"E2E Intel[\s\S]{0,800}Placed", text(html)) is not None)
submit(CS, ADMIN, find_form(html, must=["note"]), {"note": "E2E note: strong in UVM"})
_, _, html = get(CS, ADMIN)
check("note added", "E2E note: strong in UVM" in html)
check("profile starts unverified", "Profile not verified" in text(html))
submit(CS, ADMIN, find_form(html, button="Mark profile verified"), button="Mark profile verified")
_, _, html = get(CS, ADMIN)
check("profile verified by staff", "Profile verified by" in text(html))
check("documents limited to photo, resume, ID proof", 'value="photo"' in html and 'value="certificate"' not in html.split("Documents")[-1][:3000])

# student edits own profile from the portal; office re-verifies
s, final, html = get("/portal/profile", STU)
check("student can open My Profile", s == 200 and final == "/portal/profile" and "Save profile" in html)
check("student form hides office-only fields", 'name="ref.zoom"' not in html and 'name="validity_end"' not in html and 'name="after.company"' not in html)
f = find_form(html, must=["full_name", "family.father_name"])
s, _, body = submit("/portal/profile", STU, f, {"family.father_name": "E2E Father Self", "edu.2.institution": "E2E Self College"})
check("student saves own profile", "The office will review" in body, text(body)[:200])
_, _, html = get("/students/s-002", ADMIN)
check("office sees the student's update and it needs verification", "E2E Father Self" in html and "Profile not verified" in text(html))

# 26. staff calendar & reminders
s, final, html = get("/calendar", ADMIN)
check("calendar month view opens", s == 200 and final == "/calendar" and "HR meeting" in html and "Pending Reminders" in html and "Create Reminder" in html and "Upcoming Activities" in html)
for v in ["week", "day"]:
    s, _, html = get(f"/calendar?view={v}", ADMIN)
    check(f"calendar {v} view opens", s == 200 and "Staff Calendar &amp; Reminders" in html)
_, _, html = get(f"/calendar?new={TODAY}", ADMIN)
f = find_form(html, must=["title", "date", "start_time"])
check("event form offers categories, priority, assignee and reminders", {"category", "priority", "assignee_id", "reminders", "channels"} <= set(f["names"]))
s, loc, body = submit("/calendar", ADMIN, f, {"title": "E2E calendar meeting", "date": str(TODAY), "start_time": "16:00", "end_time": "17:00", "category": "meeting", "priority": "high", "assignee_id": "st-2", "location": "Room 2"})
ev = (re.search(r"event=([\w-]+)", loc or "") or [None, None])[1]
check("event added", s in (302, 303, 307) and "saved=added" in (loc or "") and ev, f"status {s} loc {loc} {text(body)[:200]}")
_, _, html = get(loc, ADMIN)
check("new event shows on the calendar with its details", "Reminder saved" in html and "E2E calendar meeting" in html and "Sowmya Rao" in html and "16:00" in html)
_, _, html = get(f"/calendar?view=week&date={TODAY}", ADMIN)
check("new event shows in week view", "E2E calendar meeting" in html)
_, _, html = get(f"/calendar?new={TODAY}", ADMIN)
f = find_form(html, must=["title", "date", "linked"])
s, loc, _ = submit("/calendar", ADMIN, f, {"title": "E2E urgent follow-up", "date": str(TODAY), "start_time": "18:00", "category": "admission", "priority": "urgent", "assignee_id": "st-1", "linked": "Student · Adarsh Hullur (MVL2026002)"})
_, _, html = get(f"/calendar?date={TODAY}", ADMIN)
row = next((r for r in re.findall(r"<tr[\s\S]*?</tr>", html) if "E2E urgent follow-up" in r), "")
check("reminder keeps urgent priority and linked student", "Urgent" in row and "Adarsh Hullur" in row and "Admission" in row, row[:200])
_, _, html = get(f"/calendar?event={ev}&date={TODAY}", ADMIN)
f = find_form(html, must=["id", "title"])
s, loc, _ = submit("/calendar", ADMIN, f, {"title": "E2E calendar meeting (moved)", "start_time": "17:30", "end_time": ""})
_, _, html = get(f"/calendar?view=day&date={TODAY}", ADMIN)
check("event edited", "saved=updated" in (loc or "") and "E2E calendar meeting (moved)" in html and "17:30" in html)
_, _, html = get(f"/calendar?who=st-2&date={TODAY}", ADMIN)
check("assignee filter keeps the event", "E2E calendar meeting (moved)" in html)
_, _, html = get(f"/calendar?who=st-3&date={TODAY}&view=day", ADMIN)
check("assignee filter hides other people's events", "E2E calendar meeting (moved)" not in html.split("Pending Reminders")[0])
_, _, html = get(f"/calendar?new={TODAY}", ADMIN)
f = find_form(html, must=["title", "date"])
s, loc, body = submit("/calendar", ADMIN, f, {"title": "Bad year", "date": "0006-02-20"})
check("event with an impossible year is refused", "saved=added" not in (loc or ""), f"status {s}")
_, _, html = get(f"/calendar?event={ev}&date={TODAY}", ADMIN)
submit("/calendar", ADMIN, find_form(html, button="Mark as done"), button="Mark as done")
_, _, html = get("/calendar", ADMIN)
done_part = text(html).split("Recently Completed")[1]
check("marked done moves to recently completed", "E2E calendar meeting (moved)" in done_part)
_, _, html = get("/dashboard", ADMIN)
check("dashboard shows pending reminders and links to the calendar", "Pending Reminders" in html and 'href="/calendar"' in html)
s, _, _ = http("POST", "/api/cron/reminders", "", b"", {"authorization": "Bearer wrong"})
check("reminder job refuses a wrong secret", s == 401)
s, _, raw = http("POST", "/api/cron/reminders", "", b"", {"authorization": "Bearer e2e-secret"})
check("reminder job runs", s == 200 and b'"ok":true' in raw, raw[:200])
_, _, html = get(f"/calendar?event={ev}&date={TODAY}", ADMIN)
submit("/calendar", ADMIN, find_form(html, button="Delete"), button="Delete")
_, _, html = get(f"/calendar?view=day&date={TODAY}", ADMIN)
check("event deleted", "E2E calendar meeting (moved)" not in html)

# 27. HR incentives: auto commission from leads & admissions, activity approval, milestones, rules, targets, payouts
s, final, html = get("/incentives?staff=st-1", ADMIN)
check("HR dashboard opens", s == 200 and all(k in text(html) for k in ["This month earned", "Lead conversion", "Monthly targets", "HR commission rules", "Top HR performers", "Monthly achievement summary"]))
for p in ["/incentives/earnings", "/incentives/admin"]:
    s, final, _ = get(p, ADMIN)
    check(f"page {p}", s == 200 and final == p)
s, final, _ = get("/incentives", STU)
check("students can't open the HR dashboard", final != "/incentives")
_, _, html = get("/leads", ADMIN)
f = find_form(html, must=["full_name", "source"])
s, loc, _ = submit("/leads", ADMIN, f, {"full_name": "E2E Funnel Lead", "phone": "9333333333", "source": "Website", "assigned_to": "Sowmya Rao"})
lead_id = (re.search(r"id=([\w-]+)", loc or "") or [None, None])[1]
check("lead created for Sowmya", bool(lead_id), f"loc {loc}")
for stage in ["interested", "visited"]:
    _, _, html = get(f"/leads?id={lead_id}", ADMIN)
    submit(f"/leads?id={lead_id}", ADMIN, find_form(html, button=f"Mark {stage}"), button=f"Mark {stage}")
_, _, html = get("/incentives/earnings?staff=st-2", ADMIN)
t = text(html)
check("lead → interested → visited credited ₹300 + ₹300", "E2E Funnel Lead" in t and "Lead → Interested" in t and "Interested → Visited" in t)
_, _, html = get(f"/students/new?lead={lead_id}", ADMIN)
f = find_form(html, must=["full_name", "course_id"])
s, loc, body = submit("/students/new", ADMIN, f, {"full_name": "E2E Funnel Lead", "category": "college", "course_id": f["selects"]["course_id"]["options"][0], "college_name": "E2E Engineering College", "college_city": "Bengaluru", "college_state": "Karnataka"})
check("lead converted to admission", s in (302, 303, 307) and "/students/" in (loc or ""), f"status {s} {text(body)[:200]}")
_, _, html = get("/incentives/earnings?staff=st-2", ADMIN)
rows = [r for r in re.findall(r"<tr[\s\S]*?</tr>", html) if "E2E Funnel Lead" in r]
check("admission credited ₹400 (total ₹1,000 for the lead, as a college admission)", len(rows) == 3 and any("Visited → Admission" in r and "college" in r for r in rows), f"{len(rows)} rows")
_, _, html = get(f"/leads?id={lead_id}", ADMIN)
_, _, html = get("/students/new", ADMIN)
f = find_form(html, must=["full_name", "course_id"])
check("admission form asks who admitted and the commission type", "counsellor_id" in f["names"] and "commission_type" in f["names"])
s, loc, _ = submit("/students/new", ADMIN, f, {"full_name": "E2E Bulk Student", "category": "normal", "course_id": f["selects"]["course_id"]["options"][0], "counsellor_id": "st-3", "commission_type": "admission_bulk"})
_, _, html = get("/incentives/earnings?staff=st-3", ADMIN)
check("direct admission credits the chosen HR", re.search(r"Bulk admission[\s\S]{0,400}E2E Bulk Student[\s\S]{0,600}500", html) is not None)

# HR logs activities; admin approves / rejects; milestone kicks in
_, _, html = get("/incentives/earnings", ADMIN)
f = find_form(html, must=["rule_key", "quantity", "occurred_on"])
submit("/incentives/earnings", ADMIN, f, {"staff_id": "st-1", "rule_key": "review", "quantity": "50", "ref_label": "E2E batch of reviews", "occurred_on": str(TODAY)})
submit("/incentives/earnings", ADMIN, f, {"staff_id": "st-1", "rule_key": "interview", "quantity": "1", "ref_label": "E2E fake interview", "occurred_on": str(TODAY)})
s, loc, _ = submit("/incentives/earnings", ADMIN, f, {"staff_id": "st-1", "rule_key": "review", "quantity": "1", "occurred_on": "0006-02-20"})
check("activity with an impossible year is refused", "saved=logged" not in (loc or ""))
_, _, html = get("/incentives/admin", ADMIN)
check("logged activities wait in the approval queue", "E2E batch of reviews" in html and "E2E fake interview" in html)
forms = forms_of(html)
def queue_form(label, btn):
    i = html.index(label)
    for fm in forms:
        if any(btn.lower() in b["text"].lower() for b in fm["buttons"]) and fm["start"] > i:
            return fm
f = queue_form("E2E batch of reviews", "Approve")
submit("/incentives/admin", ADMIN, f, button="Approve")
_, _, html = get("/incentives/admin", ADMIN)
forms = forms_of(html)
submit("/incentives/admin", ADMIN, queue_form("E2E fake interview", "Reject"), button="Reject")
_, _, html = get("/incentives/earnings?staff=st-1", ADMIN)
t = text(html)
check("approved reviews earn ₹10 each", re.search(r"E2E batch of reviews[\s\S]{0,80}50[\s\S]{0,40}500", t) is not None)
check("reaching 50 reviews adds the milestone incentive", "Milestone: 50 reviews" in t)
check("rejected activity shows as rejected", re.search(r"E2E fake interview[\s\S]{0,120}rejected", t) is not None)

# admin edits a rule and a target
_, _, html = get("/incentives/admin", ADMIN)
f = find_form(html, must=["amount.review"])
submit("/incentives/admin", ADMIN, f, {"amount.review": "20"})
_, _, html = get("/incentives?staff=st-1", ADMIN)
check("rule change shows on the dashboard", re.search(r"Student review \(internal\)[\s\S]{0,40}₹20", text(html)) is not None)
_, _, html = get(f"/incentives/admin?scope_staff=st-1&scope_month={str(TODAY)[:7]}", ADMIN)
f = find_form(html, must=["target.admissions", "scope_staff"])
submit("/incentives/admin", ADMIN, f, {"target.admissions": "10"})
_, _, html = get("/incentives?staff=st-1", ADMIN)
check("per-person monthly target applies", re.search(r"Admissions \(target 10 ?\) 1?\d+ / 10\b", text(html)) is not None)
_, _, html = get("/incentives?staff=st-2", ADMIN)
check("other staff keep the default target", re.search(r"Admissions \(target 40 ?\)", text(html)) is not None)

# month-end payout
_, _, html = get("/incentives/admin", ADMIN)
i = html.index("Payouts")
f = next(fm for fm in forms_of(html) if fm["start"] > i and any("Mark paid" in b["text"] for b in fm["buttons"]))
seg = html[:f["start"]]
who = re.sub(r"<[^>]+>", " ", seg[seg.rfind("<tr"):]).split("₹")[0].strip()
s, loc, _ = submit("/incentives/admin", ADMIN, f, button="Mark paid")
_, _, html = get(loc, ADMIN)
row = next((r for r in re.findall(r"<tr[\s\S]*?</tr>", html) if who and who in r and "Settled" in r), None)
check("payout marked paid", "Marked as paid" in html and row is not None, who)

# 28. placement WhatsApp group: link only after accepting the placement terms
GROUP = "https://chat.whatsapp.com/E2ETESTGROUP"  # the test server runs with PLACEMENT_WHATSAPP_GROUP_URL set to this
_, _, html = get("/portal/agreement", STU)
check("group link is never printed in the page", GROUP not in html)
if "Agree &amp; Activate Placement Profile" in html or "Agree & Activate Placement Profile" in html:
    f = find_form(html, button="Agree")
    vals = {n: "on" for n, _, t in f["fields"] if t == "checkbox"}
    submit("/portal/agreement", STU, f, vals, button="Agree")
    _, _, html = get("/portal/agreement", STU)
check("join button shown after accepting the terms", 'href="/portal/agreement/join"' in html)
s, h, _ = http("GET", "/portal/agreement/join", STU)
loc = h.get("Location") or h.get("location")
check("join button opens the MasterVLSI WhatsApp group", s in (302, 303, 307) and (loc or "").startswith(GROUP), f"status {s} loc {loc}")
_, _, html = get("/portal/agreement", STU)
check("join is recorded for the placement team", "Open WhatsApp Placement Group" in html)
s, h, _ = http("GET", "/portal/agreement/join", "")
loc = h.get("Location") or h.get("location")
check("join link needs a signed-in student", GROUP not in (loc or ""), f"status {s} loc {loc}")

# 29. Earn & Rewards: referral, feedback → goodie, social target → goodie, mentorship, incident, admin controls
s, final, html = get("/portal/earn", STU)
check("earn & rewards page opens", s == 200 and all(k in text(html) for k in ["This Month Earned", "Refer a Student", "Feedback / Review Submission", "Social Media Activity", "Mentorship Application", "Report an Incident", "Activity Targets"]))
for p in ["/portal/earn/activities", "/portal/earn/history", "/portal/earn/ambassador"]:
    s, final, _ = get(p, STU)
    check(f"student page {p}", s == 200 and final == p)
s, final, _ = get("/ambassadors", STU)
check("students can't open the admin control panel", final != "/ambassadors")
f = find_form(html, must=["name", "phone", "college"])
s, loc, _ = submit("/portal/earn", STU, f, {"name": "E2E Referred Friend", "phone": "9876500011", "email": "friend@example.com", "info": "B.E ECE 2026"})
check("referral submitted", "saved=" in (loc or ""), loc)
check("referral becomes a lead", "E2E Referred Friend" in get("/leads", ADMIN)[2])
for i in range(4):
    _, _, html = get("/portal/earn", STU)
    s, loc, _ = submit("/portal/earn", STU, find_form(html, button="Submit feedback"), {"text": f"E2E feedback number {i + 1} – labs are good"})
check("4 feedbacks submitted", "saved=" in (loc or ""), loc)
def verify_all(marker):
    for _ in range(10):
        _, _, h = get("/ambassadors?show=pending", ADMIN)
        if marker not in h:
            return
        i = h.index(marker)
        fm = next((x for x in forms_of(h) if x["start"] > i and any(b["text"].strip() in ("Verify", "Approve") for b in x["buttons"])), None)
        if not fm:
            return
        submit("/ambassadors", ADMIN, fm, button=fm["buttons"][0]["text"].strip())
verify_all("E2E feedback number")
_, _, html = get("/portal/earn", STU)
check("4 verified feedbacks = eligible for goodie", "Eligible for Goodie!" in html and re.search(r"\(\s*4\s*/\s*4\s*verified\)", text(html)) is not None)
check("goodie shows in rewards history", "4 verified feedbacks" in get("/portal/earn/history", STU)[2])
f = find_form(html, must=["platform", "likes", "shares", "subscribes"])
submit("/portal/earn", STU, f, {"platform": "youtube", "likes": "6000", "shares": "3000", "subscribes": "1000", "proof_url": "https://example.com/e2e-proof"})
verify_all("YouTube – 6000 likes")
_, _, html = get("/portal/earn", STU)
check("10,000 social activities reach the target", re.search(r"10,000\s*/\s*10,000\s*\(\s*100\s*%\)", text(html)) is not None and "Target Achieved" in html)
MENTEE = "mvl_demo=student:s-005"  # a student without a mentorship application yet
_, _, mhtml = get("/portal/earn", MENTEE)
f = find_form(mhtml, must=["domain", "start", "end"])
s, loc, _ = submit("/portal/earn", MENTEE, f, {"domain": "UVM", "start": str(TODAY), "end": str(TODAY + dt.timedelta(days=60)), "agree_duration": "on", "agree_terms": "on"})
check("mentorship shorter than 4 months is refused", "error=" in (loc or "") and "4" in urllib.parse.unquote(loc or ""), loc)
s, loc, _ = submit("/portal/earn", MENTEE, f, {"domain": "UVM", "start": str(TODAY), "end": str(TODAY + dt.timedelta(days=130)), "agree_duration": "on", "agree_terms": "on"})
check("mentorship application submitted", "saved=" in (loc or ""), loc)
f = find_form(html, must=["about", "description"])
s, loc, _ = submit("/portal/earn", STU, f, {"about": "E2E Someone", "date": str(TODAY), "description": "E2E incident: misuse of lab system during class hours."})
check("incident report submitted", "saved=" in (loc or ""), loc)
_, _, html = get("/ambassadors?show=all", ADMIN)
check("office sees the confidential incident", "Confidential" in html and "E2E Someone" in html)
# admin: pause institute feedback → students can't submit
_, _, html = get("/ambassadors", ADMIN)
f = find_form(html, must=["target.institute_feedback", "type.referral"])
vals = {n: "on" for n, v, t in f["fields"] if t == "checkbox" and n.startswith("active.")}
vals["paused.institute_feedback"] = "on"
s, loc, _ = submit("/ambassadors", ADMIN, f, vals)
check("admin saves reward settings", "saved=" in (loc or ""), loc)
_, _, html = get("/portal/earn", STU)
check("paused activity shows as paused to students", "Paused by the office" in html)
s, loc, _ = submit("/portal/earn", STU, find_form(html, button="Submit feedback"), {"text": "E2E feedback while paused – should fail"})
check("paused activity refuses new submissions", "error=" in (loc or ""), loc)
f = find_form(get("/ambassadors", ADMIN)[2], must=["target.institute_feedback", "type.referral"])
vals = {n: "on" for n, v, t in f["fields"] if t == "checkbox" and n.startswith("active.")}
submit("/ambassadors", ADMIN, f, vals)
f = find_form(get("/ambassadors", ADMIN)[2], must=["academic_year", "valid_from"])
s, loc, _ = submit("/ambassadors", ADMIN, f, {"academic_year": "2026 / 2027", "valid_from": "2026-06-01", "valid_to": "2027-05-31"})
check("admin saves program controls", "saved=" in (loc or ""), loc)
for t_ in ["activities", "students", "claims"]:
    s, h, raw = http("GET", f"/api/export/rewards?type={t_}", ADMIN)
    check(f"rewards report {t_} downloads", s == 200 and "text/csv" in (h.get("content-type") or h.get("Content-Type") or ""), f"status {s}")
s, _, _ = http("GET", "/api/export/rewards?type=activities", STU)
check("students can't download reward reports", s == 403)
_, _, html = get("/ambassadors", ADMIN)
before = text(get("/portal/earn", STU)[2])
i = html.index("Reward claims")
fm = next(x for x in forms_of(html) if x["start"] > i and any("Mark collected" in b["text"] for b in x["buttons"]))
s, loc, _ = submit("/ambassadors", ADMIN, fm, button="Mark collected")
check("goodie marked collected", "saved=" in (loc or ""), loc)

# 30. Student Management 360°: reminders, profile completion, payments with office approval, requests,
#     validity extension, interviews (upcoming / missed with explanation), resume library, history
for p in ["/portal", "/portal/training", "/portal/attendance", "/portal/fees", "/portal/interviews", "/portal/resumes", "/portal/requests",
          "/portal/certificates", "/portal/access", "/portal/history", "/portal/alumni"]:
    s, final, html = get(p, STU)
    check(f"360 page {p}", s == 200 and final == p and "Application error" not in html, f"status {s} at {final}")
    if p not in ("/portal", "/portal/alumni"):
        check(f"reminder center shown on {p}", 'data-testid="action-strip"' in html)
_, _, html = get("/portal", STU)
t = text(html)
check("dashboard: profile completion and overview KPIs", re.search(r"Profile completion: \d+%", t) is not None and all(k in t for k in ["Pending activities", "Upcoming interviews", "Missed interviews", "Last attendance", "Outstanding fee", "Learning progress", "Training expiry"]))
check("alumni menu hidden during training", 'href="/portal/alumni"' not in html)
_, _, html = get("/portal/alumni", STU)
check("alumni profile locked during training", "opens after your training validity ends" in text(html))
s, final, _ = get("/student-desk", STU)
check("students can't open the student desk", final != "/student-desk")
s, final, html = get("/student-desk", ADMIN)
check("student desk opens for staff", s == 200 and "Payment verification" in html)

# profile: career objective counts toward completion; husband details only for married female students
_, _, html = get("/portal/profile", STU)
f = find_form(html, must=["full_name", "career_objective"])
submit("/portal/profile", STU, f, {"career_objective": "E2E objective: become a DV engineer", "gender": "Male", "marital_status": "Married"})
_, _, html = get("/portal/profile", STU)
check("career objective saved", "E2E objective: become a DV engineer" in html)
check("no husband section for a male student", "Husband details" not in html)
_, _, html = get("/portal", STU)
check("career objective no longer missing", "Career objective" not in text(html).split("Profile completion")[1][:400] if "Profile completion" in text(html) else False)

# fees: student submits → pending → office approves → receipt
_, _, html = get("/portal/fees", STU)
receipts_before = html.count('href="/portal/receipt/')
try:
    f = find_form(html, must=["installment_id", "amount", "mode"])
except AssertionError:
    f = None
check("fees page has the payment submission form", f is not None or "All installments are paid" in html)
if f:
    s, loc, _ = submit("/portal/fees", STU, f, {"amount": "1234", "mode": "UPI", "reference": "", "paid_on": str(TODAY)})
    check("UPI submission without a reference is refused", "error=" in (loc or ""), loc)
    s, loc, _ = submit("/portal/fees", STU, f, {"amount": "1234", "mode": "UPI", "reference": "E2E-UTR-555", "paid_on": str(TODAY)},
                       files={"proof": ("proof.png", "image/png", b"\x89PNG\r\n\x1a\n" + b"0" * 64)})
    check("student submits a payment", "saved=" in (loc or ""), loc)
    _, _, html = get("/portal/fees", STU)
    check("submission waits for office verification (no receipt yet)", "Pending verification" in html and html.count('href="/portal/receipt/') == receipts_before)
    _, _, desk = get("/student-desk?tab=payments", ADMIN)
    check("office sees the submission with proof", "E2E-UTR-555" in desk and "/api/documents/" in desk)
    i = desk.index("E2E-UTR-555")
    fm = next(x for x in forms_of(desk) if x["start"] > i and any("Approve" in b["text"] for b in x["buttons"]))
    s, loc, _ = submit("/student-desk", ADMIN, fm, {"office_note": "E2E verified"}, button="Approve")
    check("office approves the payment", "saved=" in (loc or ""), loc)
    _, _, html = get("/portal/fees", STU)
    check("receipt available after approval", html.count('href="/portal/receipt/') == receipts_before + 1 and "E2E verified" in html)

# requests: certificate application → office approval
_, _, html = get("/portal/requests?kind=certificate", STU)
s, loc, _ = submit("/portal/requests", STU, find_form(html, must=["kind", "cert_type"]), {"cert_type": "Course completion", "details": "E2E certificate request"})
check("certificate application sent", "saved=" in (loc or ""), loc)
_, _, desk = get("/student-desk?tab=requests", ADMIN)
i = desk.index("E2E certificate request")
fm = next(x for x in forms_of(desk) if x["start"] > i and "response" in x["names"])
s, loc, _ = submit("/student-desk", ADMIN, fm, {"status": "approved", "response": "E2E certificate ready"})
check("office approves the certificate request", "saved=" in (loc or ""), loc)
check("student sees the approval on Certificates", "E2E certificate ready" in get("/portal/certificates", STU)[2])
s, loc, _ = submit("/portal/requests", STU, find_form(get("/portal/requests?kind=support", STU)[2], must=["kind", "subject"]), {"subject": "E2E ticket", "details": "Lab PC 4 is slow"})
check("support ticket raised", "saved=" in (loc or ""), loc)

# validity extension: one open request at a time; approval extends validity
_, _, html = get("/portal/requests?kind=validity_extension", STU)
f = find_form(html, must=["kind", "months"])
s, loc, _ = submit("/portal/requests", STU, f, {"months": "3", "details": "E2E extension"})
first = "saved=" in (loc or "")
s, loc2, _ = submit("/portal/requests", STU, f, {"months": "3", "details": "E2E extension again"})
check("only one open validity extension at a time", "error=" in (loc2 or ""), loc2)
before = re.search(r"Valid until\s+([0-9A-Za-z ]+?\d{4})", text(get("/portal/training", STU)[2]))
_, _, desk = get("/student-desk?tab=requests", ADMIN)
i = desk.index("Validity extension")
fm = next(x for x in forms_of(desk) if x["start"] > i and "response" in x["names"])
submit("/student-desk", ADMIN, fm, {"status": "approved", "response": "E2E extended"})
after = re.search(r"Valid until\s+([0-9A-Za-z ]+?\d{4})", text(get("/portal/training", STU)[2]))
check("approved extension moves the validity date", before and after and before[1] != after[1], f"{before and before[1]} -> {after and after[1]}")

# interviews: scheduled → reminder (acknowledge) → missed → explanation
_, _, desk = get("/student-desk?tab=interviews", ADMIN)
f = find_form(desk, must=["student_id", "company", "date"])
s, loc, _ = submit("/student-desk", ADMIN, f, {"student_id": "s-002", "company": "E2E Chips", "date": str(TODAY + dt.timedelta(days=2)), "time": "11:00", "round": "Technical 1", "call_letter_url": "javascript:alert(1)"})
check("call letter link must be https", "error=" in (loc or ""), loc)
s, loc, _ = submit("/student-desk", ADMIN, f, {"student_id": "s-002", "company": "E2E Chips", "date": str(TODAY + dt.timedelta(days=2)), "time": "11:00", "round": "Technical 1", "call_letter_url": "https://example.com/e2e-call-letter.pdf"})
check("office schedules an interview", "saved=" in (loc or ""), loc)
_, _, html = get("/portal", STU)
check("upcoming interview appears in the student's reminders", "Upcoming interview — E2E Chips" in html)
check("call letter shown on interviews page", "https://example.com/e2e-call-letter.pdf" in get("/portal/interviews", STU)[2])
i = html.index("Upcoming interview — E2E Chips", html.index('id="actions"'))
fm = next(x for x in forms_of(html) if x["start"] > i and any("Acknowledge" in b["text"] for b in x["buttons"]))
submit("/portal", STU, fm, button="Acknowledge")
check("acknowledged reminder is hidden", "Upcoming interview — E2E Chips" not in get("/portal", STU)[2])
_, _, desk = get("/student-desk?tab=interviews", ADMIN)
i = desk.index("E2E Chips")
fm = next(x for x in forms_of(desk) if x["start"] > i and "outcome" in x["names"])
s, loc, _ = submit("/student-desk", ADMIN, fm, {"status": "missed", "outcome": ""})
check("office marks the interview missed", "saved=" in (loc or ""), loc)
_, _, html = get("/portal", STU)
check("missed interview stays in reminders until explained", "Missed interview — E2E Chips" in html)
_, _, html = get("/portal/interviews", STU)
i = html.index("E2E Chips")
fm = next(x for x in forms_of(html) if x["start"] > i and "explanation" in x["names"])
s, loc, _ = submit("/portal/interviews", STU, fm, {"explanation": "short"})
check("too-short explanation refused", "error=" in (loc or ""), loc)
s, loc, _ = submit("/portal/interviews", STU, fm, {"explanation": "E2E: I was unwell with fever that day and could not join."})
check("student explains the missed interview", "saved=" in (loc or ""), loc)
check("explained interview leaves the reminders", "Missed interview — E2E Chips" not in get("/portal", STU)[2])
check("office reads the explanation", "I was unwell with fever" in get("/student-desk?tab=interviews", ADMIN)[2])

# resume library: upload, default, choose for a drive
_, _, html = get("/portal/resumes", STU)
s, loc, _ = submit("/portal/resumes", STU, find_form(html, must=["title", "domain", "version"]), {"title": "E2E PD Resume", "domain": "Physical Design", "version": "v2"},
                   files={"file": ("resume.pdf", "application/pdf", b"%PDF-1.4\n%e2e\n")})
check("resume uploaded to the library", "saved=" in (loc or ""), loc)
_, _, html = get("/portal/resumes", STU)
check("resume listed with domain and version", "E2E PD Resume" in html and "Physical Design" in html and "v2" in html)
_, _, html = get("/portal/drives", STU)
if "resume_id" in html:
    f = find_form(html, must=["resume_id"], button="Yes, interested")
    rid = next((o for o in f["selects"]["resume_id"]["options"]), "")
    m = re.search(r'<option value="([^"]+)">E2E PD Resume', html)
    submit("/portal/drives", STU, f, {"resume_id": m[1] if m else rid}, button="Yes, interested")
    check("drive answer records the chosen resume", "Resume: " in text(get("/portal/drives", STU)[2]) and "E2E PD Resume" in get("/portal/drives", STU)[2])
else:
    check("drives page offers a resume choice", False, "no resume select")

# history & staff summary
check("history timeline lists the student's activity", all(k in text(get("/portal/history", STU)[2]) for k in ["Admitted to", "Interview with E2E Chips"]))
_, _, html = get("/students/s-002", ADMIN)
check("office student page shows completion and reminders", "Profile completion:" in text(html) and "Student reminders" in text(html))

# 31. Lead Management 360°: tabs, 10-stage pipeline, duplicate prevention, bulk upload, allocation,
#     counsellor workspace, mandatory follow-up remarks, daily report (+ automatic), archive
TABS31 = ["dashboard", "all", "pipeline", "allocation", "workspace", "followups", "report", "calendar", "upload", "duplicates", "counsellors", "admissions", "analytics", "history", "audit", "archive"]
for t_ in TABS31:
    s, final, html = get(f"/leads?tab={t_}", ADMIN)
    check(f"leads tab {t_}", s == 200 and "Application error" not in html and "Lead Management 360" in html, f"status {s}")
_, _, html = get("/leads?tab=pipeline", ADMIN)
check("pipeline has all ten stages", all(k in text(html) for k in ["New lead", "Non-connected", "Connected", "Interested", "Visit scheduled", "Visited", "Admission pending", "Converted", "Not interested", "Future follow-up"]))
s, final, _ = get("/leads", STU)
check("students can't open lead management", not final.startswith("/leads"))
_, _, html = get("/leads", ADMIN)
f = find_form(html, must=["full_name", "source"])
existing = re.search(r"98\d{8}", text(get("/leads?tab=all", ADMIN)[2]))[0]
s, loc, _ = submit("/leads", ADMIN, f, {"full_name": "E2E Dup Lead", "phone": "+91 " + existing, "source": "Website"})
check("duplicate mobile (another lead) is refused", "error=" in (loc or "") and "Duplicate" in urllib.parse.unquote(loc or ""), loc)
stu_phone = re.search(r"\b(9\d{9})\b", text(get("/students/s-003", ADMIN)[2]))
if stu_phone:
    s, loc, _ = submit("/leads", ADMIN, f, {"full_name": "E2E Student Dup", "phone": stu_phone[1], "source": "Website"})
    check("duplicate mobile (registered student) is refused", "error=" in (loc or "") and "student" in urllib.parse.unquote(loc or ""), loc)
s, loc, _ = submit("/leads", ADMIN, f, {"full_name": "E2E Lead360", "phone": "9444400001", "source": "Website", "assigned_to": "Rakesh Kumar"})
lead360 = (re.search(r"id=([\w-]+)", loc or "") or [None, None])[1]
check("new lead saved and allocated", bool(lead360), loc)
check("allocation logged with the creator", "Allocated to Rakesh Kumar" in get(f"/leads?id={lead360}", ADMIN)[2])

# bulk upload: in-file duplicate, existing number and invalid rows are removed
_, _, html = get("/leads?tab=upload", ADMIN)
csv_rows = "name,phone,email,city\nE2E Bulk One,9444400002,b1@example.com,Mysuru\nE2E Bulk Again,94444 00002,,\nE2E Existing,9444400001,,\nNo Phone,,,\n"
s, loc, _ = submit("/leads", ADMIN, find_form(html, must=["csv", "source"]), {"csv": csv_rows, "to": ""})
msg = urllib.parse.unquote(loc or "")
check("bulk upload removes duplicates", "1 added" in msg and "2 duplicates removed" in msg and "1 rows skipped" in msg, msg)
_, _, html = get("/leads?tab=allocation", ADMIN)
check("uploaded lead waits in Unassigned", "E2E Bulk One" in html)
i = html.index('id="unassigned"')
fm = next(x for x in forms_of(html) if x["start"] >= i - 50 and "ids" in x["names"])
vals = {"to": "Sowmya Rao", "deadline_date": str(TODAY + dt.timedelta(days=1)), "deadline_time": "13:00", "priority": "high", "instructions": "E2E call before 1 PM"}
# tick only the uploaded lead
bulk_id = re.search(r'value="([\w-]+)"[^>]*aria-label="Select E2E Bulk One"', html) or re.search(r'aria-label="Select E2E Bulk One"[^>]*value="([\w-]+)"', html)
fm["fields"] = [x for x in fm["fields"] if x[0] != "ids"]
s, loc, _ = submit("/leads", ADMIN, fm, {**vals, "ids": bulk_id[1] if bulk_id else ""})
check("bulk allocation with deadline, priority and instructions", "saved=" in (loc or "") and "Sowmya" in urllib.parse.unquote(loc or ""), loc)
_, _, html = get("/leads?tab=workspace&as=Sowmya Rao".replace(" ", "%20"), ADMIN)
check("counsellor workspace shows the new allocation", "New allocation: E2E Bulk One" in text(html) and "E2E call before 1 PM" in text(html))
check("allocation history records it", "E2E call before 1 PM" in get("/leads?tab=history", ADMIN)[2])

# reallocation of the created lead from Rakesh to Sowmya
_, _, html = get("/leads?tab=allocation", ADMIN)
fm = find_form(html, must=["ids", "to"], button="Allocate lead")
s, loc, _ = submit("/leads", ADMIN, fm, {"ids": lead360, "to": "Sowmya Rao"})
check("reallocation saved", "saved=" in (loc or ""), loc)
check("reallocation keeps the earlier counsellor in history", "Reallocated from Rakesh Kumar to Sowmya Rao" in get(f"/leads?id={lead360}", ADMIN)[2])

# follow-up: remarks and next action are mandatory
bid = bulk_id[1]
_, _, html = get(f"/leads?id={bid}", ADMIN)
fm = find_form(html, must=["outcome", "remarks", "next_action"])
s, loc, _ = submit("/leads", ADMIN, fm, {"outcome": "interested", "remarks": "", "next_action": "x", "next_date": str(TODAY + dt.timedelta(days=2))})
check("follow-up without remarks refused", "error=" in (loc or ""), loc)
s, loc, _ = submit("/leads", ADMIN, fm, {"outcome": "interested", "remarks": "E2E spoke about DV batch and fee", "next_action": "", "next_date": ""})
check("follow-up without next action refused", "error=" in (loc or ""), loc)
s, loc, _ = submit("/leads", ADMIN, fm, {"outcome": "interested", "remarks": "E2E spoke about DV batch and fee", "next_action": "E2E share fee PDF", "next_date": str(TODAY + dt.timedelta(days=2)), "next_time": "11:00"})
check("follow-up completed", "saved=" in (loc or ""), loc)
_, _, html = get(f"/leads?id={bid}", ADMIN)
t = text(html)
check("lead moved to Interested with conversation kept", "E2E spoke about DV batch and fee" in t and "Interested" in t and "E2E share fee PDF" in t)
_, _, html = get("/leads?tab=followups", ADMIN)
check("next action becomes an open follow-up task", "E2E share fee PDF" in html)
_, _, html = get("/leads?tab=report", ADMIN)
row = next((r for r in re.findall(r"<tr[\s\S]*?</tr>", html) if "Sowmya Rao" in r), "")
nums = [int(x) for x in re.findall(r">(\d+)<", row)]
tot = [int(x) for x in re.findall(r">(\d+)<", next((r for r in re.findall(r"<tr[\s\S]*?</tr>", html) if ">Total<" in r), ""))]
check("daily report: Sowmya's allocations counted", len(nums) >= 9 and nums[0] >= 2, str(nums))
check("daily report: connected and interested counted", len(tot) >= 9 and tot[3] >= 1 and tot[5] >= 1, str(tot))
check("detailed activity register lists the follow-up", "E2E spoke about DV batch and fee" in html)
s, h, raw = http("GET", f"/api/export/lead-report?date={TODAY}", ADMIN)
check("daily report exports to CSV", s == 200 and b"Daily Lead Management Report" in raw and b"Sowmya Rao" in raw)
s, _, _ = http("GET", "/api/export/lead-report", STU)
check("students can't export the lead report", s == 403)
s, _, _ = http("GET", "/api/export/leads", ADMIN)
check("admins can export leads", s == 200)

# task completion is separate from lead closure
_, _, html = get("/leads?tab=workspace&as=Sowmya%20Rao", ADMIN)
i = html.index("E2E share fee PDF")
fm = next(x for x in forms_of(html) if x["start"] > i and "remarks" in x["names"] and any("Done" in b["text"] for b in x["buttons"]))
s, loc, _ = submit("/leads", ADMIN, fm, {"remarks": "E2E PDF sent"}, button="Done")
check("task completed from the workspace", "saved=" in (loc or ""), loc)
check("lead stays open after its task is done", "Interested" in text(get(f"/leads?id={bid}", ADMIN)[2]) and "E2E share fee PDF" not in get("/leads?tab=followups", ADMIN)[2])

# allocate an entire stage (round-robin)
_, _, html = get("/leads?tab=allocation&stage=non_connected", ADMIN)
fm = find_form(html, must=["stage", "to"], button="Allocate stage")
s, loc, _ = submit("/leads", ADMIN, fm, {"stage": "non_connected", "to": "__round_robin", "only_unassigned": None})
check("entire stage allocated round-robin", "saved=" in (loc or "") and "round-robin" in urllib.parse.unquote(loc or ""), loc)

# duplicates: admin may save one anyway, then merge it (archived, history kept), then restore
_, _, html = get("/leads", ADMIN)
f = find_form(html, must=["full_name", "source"])
s, loc, _ = submit("/leads", ADMIN, f, {"full_name": "E2E Second Copy", "phone": "9444400002", "source": "WhatsApp", "allow_duplicate": "on"})
check("admin can knowingly save a duplicate", "id=" in (loc or ""), loc)
_, _, html = get("/leads?tab=duplicates", ADMIN)
check("duplicate group listed", "9444400002" in html and "E2E Second Copy" in html)
fm = next(x for x in forms_of(html) if any("Merge" in b["text"] for b in x["buttons"]) and x["start"] > html.index("9444400002"))
s, loc, _ = submit("/leads", ADMIN, fm, button="Merge")
check("duplicate merged into the original", "saved=" in (loc or ""), loc)
_, _, html = get("/leads?tab=archive", ADMIN)
check("merged duplicate archived with a link to the original", "E2E Second Copy" in html and "Duplicate of" in text(html))
fm = next(x for x in forms_of(html) if any("Restore" in b["text"] for b in x["buttons"]) and x["start"] > html.index("E2E Second Copy"))
s, loc, _ = submit("/leads", ADMIN, fm, button="Restore")
check("archived lead restored", "saved=" in (loc or "") and "E2E Second Copy" in get("/leads?tab=all", ADMIN)[2])

# counsellors: mark Imran as counsellor → can receive leads
_, _, html = get("/leads?tab=counsellors", ADMIN)
i = html.index('text-navy">Imran Sheikh')
fm = next(x for x in forms_of(html) if x["start"] > i and "lead_capacity" in x["names"])
s, loc, _ = submit("/leads", ADMIN, fm, {"counsellor": "on", "active": "on", "lead_capacity": "25"})
check("counsellor settings saved", "saved=" in (loc or ""), loc)
check("new counsellor available for allocation", '<option value="Imran Sheikh">' in get("/leads?tab=allocation", ADMIN)[2])

# automatic daily report (hourly job, after the configured time, once a day)
_, _, html = get("/leads?tab=report", ADMIN)
fm = find_form(html, must=["report_time", "report_email"])
s, loc, _ = submit("/leads", ADMIN, fm, {"report_time": "25:00", "report_email": ""})
check("invalid report time refused", "error=" in (loc or ""), loc)
s, loc, _ = submit("/leads", ADMIN, fm, {"report_time": "00:00", "report_email": "superadmin@example.com"})
check("report time saved", "saved=" in (loc or ""), loc)
s, _, raw = http("POST", "/api/cron/reminders", "", headers={"authorization": "Bearer e2e-secret"})
first = json.loads(raw).get("leads", {})
s, _, raw = http("POST", "/api/cron/reminders", "", headers={"authorization": "Bearer e2e-secret"})
second = json.loads(raw).get("leads", {})
check("daily lead report generated automatically, once a day", first.get("report") == "generated" and second.get("report") == "already sent", f"{first} {second}")
check("saved report listed", str(TODAY) in get("/leads?tab=report", ADMIN)[2])
check("admissions tab offers conversion", "/students/new?lead=" in get("/leads?tab=admissions", ADMIN)[2])

passed = sum(1 for r in results if r[1])
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
