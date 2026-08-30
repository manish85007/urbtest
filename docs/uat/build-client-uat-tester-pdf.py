#!/usr/bin/env python3
"""Build credential-free Client UAT Testing PDF for individual testers."""
from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Urb-TecTrack-Client-UAT-Testing.pdf"

GREEN = (15, 92, 58)
INK = (28, 35, 33)
MUTED = (90, 100, 96)
RULE = (210, 220, 214)
BG = (245, 248, 246)
LIGHT = (238, 244, 240)


def safe(text: str) -> str:
    return (
        (text or "")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2122", "")
        .replace("\u2192", "->")
        .replace("\u2610", "[ ]")
    )


class TesterPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, "Urb TecTrack  |  Client UAT Testing  |  Confidential - for named tester only", align="L")
        self.ln(3)
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, f"Page {self.page_no()}  |  No credentials in this document  |  info@urbeno.in", align="C")

    def h1(self, text: str):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*GREEN)
        self.multi_cell(self.epw, 7, safe(text))
        self.ln(2)

    def h2(self, text: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*GREEN)
        self.multi_cell(self.epw, 6, safe(text))
        self.ln(1)

    def body(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*INK)
        self.set_x(self.l_margin)
        self.multi_cell(self.epw, 4.5, safe(text))
        self.ln(1)

    def muted(self, text: str):
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.set_x(self.l_margin)
        self.multi_cell(self.epw, 4, safe(text))
        self.ln(1)

    def kv_table(self, rows: list[tuple[str, str]], col1=48.0):
        self.set_font("Helvetica", "", 8)
        for i, (k, v) in enumerate(rows):
            if self.get_y() > self.h - 20:
                self.add_page()
            y0 = self.get_y()
            fill = i % 2 == 0
            if fill:
                self.set_fill_color(*LIGHT)
            self.set_xy(self.l_margin, y0)
            self.set_text_color(*INK)
            self.set_font("Helvetica", "B", 8)
            self.multi_cell(col1, 4.2, safe(k), fill=fill)
            h1 = self.get_y() - y0
            self.set_xy(self.l_margin + col1, y0)
            self.set_font("Helvetica", "", 8)
            self.multi_cell(self.epw - col1, 4.2, safe(v), fill=fill)
            h2 = self.get_y() - y0
            self.set_y(y0 + max(h1, h2))

    def case_block(self, case_id: str, step: str, expected: str):
        if self.get_y() > self.h - 32:
            self.add_page()
        self.set_fill_color(*LIGHT)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*GREEN)
        self.cell(18, 5, safe(case_id), fill=True)
        self.set_text_color(*INK)
        self.set_font("Helvetica", "", 8)
        self.multi_cell(self.epw - 18, 5, safe(step), fill=True)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.multi_cell(self.epw, 4, safe(f"Expected: {expected}"))
        self.set_text_color(*INK)
        self.cell(0, 5, safe("Result:  [ ] Pass   [ ] Fail   [ ] N/A   [ ] Blocked     Initials: ______"), new_x="LMARGIN", new_y="NEXT")
        self.muted("Notes: _________________________________________________________________")
        self.ln(1)


def build():
    pdf = TesterPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.set_margins(14, 14, 14)

    # Cover
    pdf.add_page()
    pdf.set_fill_color(*BG)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")
    pdf.set_y(40)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*GREEN)
    pdf.multi_cell(pdf.epw, 11, "Urb TecTrack", align="C")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(*INK)
    pdf.multi_cell(pdf.epw, 7, "Client UAT Testing Document", align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        pdf.epw,
        5,
        "For individual client testers\n"
        "No usernames or passwords are included in this document",
        align="C",
    )
    pdf.set_x(pdf.l_margin)
    pdf.ln(10)
    mid = pdf.w / 2
    pdf.set_draw_color(*GREEN)
    pdf.line(mid - 35, pdf.get_y(), mid + 35, pdf.get_y())
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    for line in [
        "Portal:  https://uat.urbeno.in",
        "Role under test:  Client User (requestor)",
        "Support:  info@urbeno.in",
        "Credentials:  issued separately by Urbeno",
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 6, line, align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(12)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        pdf.epw,
        4.5,
        "Use this checklist with the Client Access Visual Guide. "
        "Mark Pass / Fail / N/A / Blocked for every case. "
        "Return completed results to info@urbeno.in.",
        align="C",
    )

    # Session + parameters
    pdf.add_page()
    pdf.h1("1. Session details")
    pdf.muted("Fill in your details. Leave Account blank until you receive credentials from Urbeno.")
    pdf.kv_table(
        [
            ("Organisation", "________________________________"),
            ("Tester name", "________________________________"),
            ("Tester email", "________________________________"),
            ("Date(s) IST", "________________________________"),
            ("Browser + version", "________________________________"),
            ("Device", "Desktop / Laptop / Tablet"),
            ("Portal URL", "https://uat.urbeno.in"),
            ("Account used", "(issued separately — do not write password here)"),
            ("Build / release note", "________________________________"),
        ]
    )
    pdf.ln(3)
    pdf.h1("2. Test parameters")
    pdf.kv_table(
        [
            ("Portal URL", "https://uat.urbeno.in"),
            ("Role", "Client User (requestor)"),
            ("Expected navigation", "Home, My Requests, Recycling Heroes, Sustainability, Reports"),
            ("Must NOT appear", "Masters, Audit, Capacity, Compliance"),
            ("Sample new-request data", "Location e.g. Loading bay; qty ~12; weight ~75 kg; at least one line item"),
            ("Tenancy rule", "Only your organisation's requests and reports"),
            ("Staff-only (hidden to you)", "Acknowledge, Assign Vehicle, Weigh, Raise Invoice, Create MRN, Upload Certificate, Form 6"),
            ("Close rule", "Review & Close only after certificate AND payment"),
            ("Password policy", "10+ chars; upper; lower; digit; not last 5 passwords"),
            ("Two-factor", "Not used for client users"),
            ("Return to", "info@urbeno.in"),
            ("Email subject", "Urb TecTrack UAT - Client findings - [Organisation] - [Date]"),
        ]
    )
    pdf.ln(2)
    pdf.body("Request ID you create:  REQ- ____________________")

    pdf.add_page()
    pdf.h1("3. How to mark results")
    pdf.kv_table(
        [
            ("Pass", "Matches Expected"),
            ("Fail", "Wrong or missing - add findings row"),
            ("N/A", "Cannot run - note why"),
            ("Blocked", "Blocked by prior Fail or environment"),
            ("Blocker", "Cannot complete core flow or sees other org data"),
            ("Major", "Rule broken; workaround exists"),
            ("Minor", "Awkward UI; process completable"),
            ("Cosmetic", "Spelling / layout only"),
        ]
    )

    # Checklist sections
    sections = [
        (
            "4. Checklist - C0 Sign-in, policies, navigation",
            [
                ("C0.1", "Open portal URL. Sign in with your issued account.", "Login succeeds."),
                ("C0.2", "If policy gate appears: open Terms and Privacy, then accept.", "Gate clears. Home welcomes you by name."),
                ("C0.3", "Review main navigation.", "Client areas only. No Masters, Audit, Capacity, Compliance."),
                ("C0.4", "Open Your profile.", "Role Client User; org correct; change password available; no two-factor."),
                ("C0.5", "Sign out, then sign in again.", "Home again. Policies not re-prompted unless updated."),
            ],
        ),
        (
            "C1 - Data isolation (critical)",
            [
                ("C1.1", "Open My Requests.", "Only your organisation's requests."),
                ("C1.2", "If Urbeno supplies another org request ID, open via address bar.", "Access refused or redirected."),
                ("C1.3", "Open Reports (Request Summary / Invoice Register).", "Your organisation only. No MRN Register."),
                ("C1.4", "Try /masters, /audit, /compliance, /capacity.", "Redirected or denied."),
            ],
        ),
        (
            "C2 - Raise a collection request (Stage 1)",
            [
                ("C2.1", "Home or My Requests -> + New Request.", "Form opens; organisation implied; site/location required."),
                ("C2.2", "Submit with required fields empty.", "Does not submit; validation messages shown."),
                ("C2.3", "Fill location, approx qty & weight, >=1 line item; Submit.", "New REQ-##### at Stage 1."),
                ("C2.4", "Check header and actions.", "Meta correct; no staff actions visible."),
            ],
        ),
        (
            "C3 - Changes requested (needs Urbeno; else N/A)",
            [
                ("C3.1", "After Urbeno requests changes: open the request.", "Changes-requested badge/note visible."),
                ("C3.2", "Edit details -> save / resubmit.", "Sent back to Urbeno; still cannot Acknowledge."),
            ],
        ),
        (
            "C4 - Visibility while staff process (Stages 2-8)",
            [
                ("C4.1", "After ack / vehicle / weigh / invoice: refresh.", "Stage advances; details appear when ready."),
                ("C4.2", "Inspect invoice / processing panels.", "No MRN number or Create MRN."),
                ("C4.3", "After recycling / Form 6.", "Progress visible; you are not asked to issue Form 6."),
                ("C4.4", "After certificate upload.", "Certificate ref/date visible; no Upload Certificate."),
                ("C4.5", "Try Review & Close before payment complete.", "Unavailable or refused."),
            ],
        ),
        (
            "C5 - Close the request (Stage 9)",
            [
                ("C5.1", "When certificate and payment exist: Review & Close.", "Confirmation modal opens."),
                ("C5.2", "Acknowledge closure.", "Closed / Stage 9."),
                ("C5.3", "Check Home completed counts.", "Counts reflect closed work."),
            ],
        ),
        (
            "C6 - Home, Sustainability, Recycling Heroes",
            [
                ("C6.1", "Home.", "Tiles and impact load; + New Request available."),
                ("C6.2", "Sustainability.", "Figures load; help / Impact PDF work if offered."),
                ("C6.3", "Recycling Heroes.", "Tree / tonnage view loads."),
            ],
        ),
        (
            "C7 - Reports and export",
            [
                ("C7.1", "Request Summary -> Export CSV if available.", "Download; your organisation only."),
                ("C7.2", "Invoice Register, Certificate Log, Sustainability, Heroes.", "Each runs; no MRN register."),
                ("C7.3", "Change period if shown.", "Figures refresh; still your org only."),
            ],
        ),
        (
            "C8 - Profile / password (optional - do last)",
            [
                ("C8.1", "Profile -> try weak password (e.g. short).", "Refused per password policy."),
                ("C8.2", "Successful password change.", "Only if Urbeno asked you; otherwise N/A."),
            ],
        ),
    ]

    for title, cases in sections:
        pdf.add_page()
        pdf.h1(title)
        for case_id, step, expected in cases:
            pdf.case_block(case_id, step, expected)

    # Findings + sign-off
    pdf.add_page()
    pdf.h1("5. Findings log")
    pdf.muted("One row per Fail / Blocked / notable observation. Quote exact on-screen messages.")
    headers = ["ID", "Case", "Severity", "Summary", "Status"]
    widths = [16, 18, 22, 90, 22]
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*INK)
    for h, w in zip(headers, widths):
        pdf.cell(w, 6, h, border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8)
    for i in range(1, 9):
        pdf.cell(widths[0], 8, f"F-{i:03d}", border=1)
        for w in widths[1:]:
            pdf.cell(w, 8, "", border=1)
        pdf.ln()

    pdf.ln(4)
    pdf.h1("6. Summary counts")
    pdf.kv_table(
        [
            ("Cases executed", "_____ of _____"),
            ("Pass", "_____"),
            ("Fail", "_____"),
            ("N/A", "_____"),
            ("Blocked", "_____"),
            ("Open Blockers", "_____"),
            ("Open Majors", "_____"),
        ]
    )

    pdf.ln(3)
    pdf.h1("7. Sign-off")
    pdf.body("Blockers found?   [ ] No   [ ] Yes - IDs: ____________________")
    pdf.body("Fit for production as a client user?   [ ] Yes   [ ] Yes, with waivers   [ ] No")
    pdf.body("Overall comments: _______________________________________________")
    pdf.ln(2)
    pdf.body("I confirm I executed this checklist and that the results are accurate.")
    pdf.ln(2)
    pdf.kv_table(
        [
            ("Tester name", "____________________"),
            ("Organisation", "____________________"),
            ("Signature", "____________________"),
            ("Date", "____________________"),
            ("Client sponsor (optional)", "____________________"),
        ]
    )

    pdf.ln(3)
    pdf.h1("8. Return results")
    pdf.body("Email completed document and screenshots to info@urbeno.in (copy your Urbeno contact).")
    pdf.body("Subject: Urb TecTrack UAT - Client findings - [Your Organisation] - [Date]")
    pdf.muted("Companion (no credentials): Urb-TecTrack-Client-Access-Visual-Guide.pdf")

    pdf.output(str(OUT))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
