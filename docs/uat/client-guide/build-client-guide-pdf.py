#!/usr/bin/env python3
"""Build a professional Client Access Visual Guide PDF (no credentials)."""
from __future__ import annotations

import json
from pathlib import Path

from fpdf import FPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
OUT = ROOT / "Urb-TecTrack-Client-Access-Visual-Guide.pdf"
MANIFEST = SHOTS / "manifest.json"

GREEN = (15, 92, 58)
INK = (28, 35, 33)
MUTED = (90, 100, 96)
RULE = (210, 220, 214)
BG = (245, 248, 246)


def ascii_safe(text: str) -> str:
    return (
        (text or "")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2122", "(TM)")
        .replace("\u2192", "->")
        .replace("\u2082", "2")
        .replace("CO₂", "CO2")
        .replace("CO₂e", "CO2e")
    )


class GuidePDF(FPDF):
    def header(self):
        if self.page_no() <= 2:
            return
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Urb TecTrack  |  Client Portal Overview  |  Confidential", align="L")
        self.ln(4)
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"Page {self.page_no()}  |  Urbeno  |  info@urbeno.in", align="C")


def fit_image(path: Path, max_w: float, max_h: float) -> tuple[float, float]:
    with Image.open(path) as im:
        w, h = im.size
    scale = min(max_w / w, max_h / h)
    return w * scale, h * scale


def add_cover(pdf: GuidePDF, base: str):
    pdf.add_page()
    pdf.set_fill_color(*BG)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")

    pdf.set_xy(pdf.l_margin, 42)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(*GREEN)
    pdf.multi_cell(pdf.epw, 12, "Urb TecTrack", align="C")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(*INK)
    pdf.multi_cell(pdf.epw, 8, "Client Portal Overview", align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        pdf.epw,
        6,
        "Visual walkthrough for client (requestor) users\n"
        "Screens captured from the live UAT environment",
        align="C",
    )
    pdf.set_x(pdf.l_margin)
    pdf.ln(12)
    pdf.set_draw_color(*GREEN)
    pdf.set_line_width(0.4)
    mid = pdf.w / 2
    pdf.line(mid - 40, pdf.get_y(), mid + 40, pdf.get_y())
    pdf.ln(12)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    for line in [
        f"Portal:  {base}",
        "Audience:  Client organisations (EHS, facilities, finance, IT, site leads)",
        "Support:  info@urbeno.in",
        "Screens captured from the live UAT environment",
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 7, line, align="C")

    pdf.set_x(pdf.l_margin)
    pdf.ln(14)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        pdf.epw,
        5,
        "This guide does not contain account credentials. Use the sign-in details "
        "issued separately by Urbeno. Use it to decide who in your organisation "
        "needs access, then follow the screens to understand the portal.",
        align="C",
    )


def add_howto(pdf: GuidePDF):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 10, "What Urb TecTrack is", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    pdf.multi_cell(
        pdf.epw,
        6,
        ascii_safe(
            "Urb TecTrack is Urbeno's e-waste collection and recycling portal. "
            "Your team raises pickup requests, tracks each job from acknowledgement "
            "through weighment, invoicing and Certificate of Destruction (CoD), "
            "and downloads reports for audit and ESG. Each organisation only sees "
            "its own data. Urbeno staff handle vehicles, MRN, recycling and CoD upload."
        ),
    )
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "Who typically needs access", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    for line in [
        "EHS / Environment / Sustainability  -  CoD, compliance trail, ESG numbers",
        "Facilities / Admin / Store  -  raise pickups and keep site history",
        "Finance / Accounts  -  invoices, outstanding and payment status",
        "IT / Asset / Store  -  serials and asset movement on each request",
        "Site / plant in-charge  -  visibility for their location",
        "Management (optional)  -  dashboard and impact; often view-only",
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 6, ascii_safe(f"- {line}"))
        pdf.ln(0.4)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "How to use this guide", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    bullets = [
        "Each page shows a live screen from the client portal and a short explanation.",
        "Sign-in credentials are issued separately by Urbeno and are omitted here.",
        "Use the left menu on desktop; on a phone the same menu slides in from the left.",
        "Reply to Urbeno with the named users who should receive access (name, email, site, function).",
    ]
    for b in bullets:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 6, ascii_safe(f"- {b}"))
        pdf.ln(1)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "Screens in this document", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)


def add_toc_lines(pdf: GuidePDF, steps: list[dict]):
    for i, step in enumerate(steps, start=1):
        pdf.set_x(pdf.l_margin)
        pdf.cell(14, 7, f"Step {i}")
        pdf.cell(0, 7, ascii_safe(step["title"]), new_x="LMARGIN", new_y="NEXT")


def add_step(pdf: GuidePDF, index: int, step: dict):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*GREEN)
    pdf.multi_cell(pdf.epw, 8, ascii_safe(f"Step {index}:  {step['title']}"))
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    pdf.multi_cell(pdf.epw, 6, ascii_safe(step.get("notes") or ""))
    pdf.ln(4)

    img_path = SHOTS / step["file"]
    if not img_path.exists():
        pdf.set_text_color(180, 40, 40)
        pdf.cell(0, 8, f"(Screenshot missing: {step['file']})")
        return

    max_w = pdf.w - pdf.l_margin - pdf.r_margin
    max_h = pdf.h - pdf.get_y() - 22
    w, h = fit_image(img_path, max_w, max_h)
    x = pdf.l_margin + (max_w - w) / 2
    pdf.image(str(img_path), x=x, y=pdf.get_y(), w=w, h=h)


def main():
    data = json.loads(MANIFEST.read_text())
    steps = data["steps"]
    pdf = GuidePDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.set_margins(16, 16, 16)

    add_cover(pdf, data.get("base", "https://uat.urbeno.in"))
    add_howto(pdf)
    add_toc_lines(pdf, steps)
    for i, step in enumerate(steps, start=1):
        add_step(pdf, i, step)

    pdf.output(str(OUT))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
