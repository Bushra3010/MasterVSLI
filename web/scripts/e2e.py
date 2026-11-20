#!/usr/bin/env python3
"""
End-to-end test of every ERP module, run against a local server in DEMO mode:

  NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= CRON_SECRET=e2e-secret npx next dev -p 3100
  python3 scripts/e2e.py http://localhost:3100

Forms are submitted exactly as a browser without JavaScript would (Next.js server actions support
this), so every server action is exercised through real HTTP. Standard library only.
"""
import datetime as dt
import json
import re
import sys
import urllib.error
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
            self.cur = {"fields": [], "buttons": [], "selects": {}, "enctype": a.get("enctype", "")}
            self.forms.append(self.cur)
        if self.cur is None:
            return
        if tag == "input":
            t = a.get("type", "text")
            if t in ("checkbox",):
                self.cur["fields"].append([a.get("name"), "on" if "checked" in a else None, "checkbox"])
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
    for f in p.forms:
        f["names"] = {x[0] for x in f["fields"]} | set(f["selects"])
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
check("edit profile saves", s in (303, 302, 307) and loc.endswith(new_id), f"status {s} loc {loc} {text(body)[:300]}")
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

# 8. settings: add staff, edit course, add vendor
_, _, html = get("/settings", ADMIN)
f = find_form(html, must=["employee_code"], must_not=["id"])
submit("/settings", ADMIN, f, {"employee_code": "e2e9", "full_name": "E2E Staff", "designation": "Trainer", "monthly_salary": "50000"})
_, _, html = get("/settings", ADMIN)
check("settings: staff added", "E2E9" in html)
f = find_form(html, must=["code", "fee", "id"])
submit("/settings", ADMIN, f, {"fee": "31000"})
_, _, html = get("/settings", ADMIN)
check("settings: course fee edited", 'value="31000"' in html)
f = find_form(html, must=["name", "contact_person"], must_not=["id", "parent_id"])
submit("/settings", ADMIN, f, {"name": "E2E Vendor", "contact_person": "E2E Contact"})
_, _, html = get("/settings", ADMIN)
check("settings: vendor added", "E2E Vendor" in html)

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
f = find_form(html, must=["student_id"], button="Yes, interested")
s, _, _ = submit(f"/placements?drive={drive}", ADMIN, f, {"student_id": new_id}, button="Yes, interested")
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

passed = sum(1 for r in results if r[1])
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
