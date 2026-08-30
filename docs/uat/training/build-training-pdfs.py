#!/usr/bin/env python3
"""Build role-wise end-user training PDFs with screenshots and elaborated steps."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fpdf import FPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent
GREEN = (15, 92, 58)
INK = (28, 35, 33)
MUTED = (90, 100, 96)
RULE = (210, 220, 214)
BG = (245, 248, 246)
TIP_BG = (255, 248, 231)


def safe(text: str) -> str:
    cleaned = (
        (text or "")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
        .replace("\u2122", "")
        .replace("\u2192", "->")
        .replace("\u2082", "2")
        .replace("\xa0", " ")
    )
    return cleaned.encode("latin-1", errors="replace").decode("latin-1")


class TrainingPDF(FPDF):
    def __init__(self, role_label: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.role_label = role_label
        self.set_auto_page_break(auto=True, margin=16)
        self.set_margins(14, 14, 14)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, safe(f"Urb TecTrack  |  {self.role_label} Training Guide  |  Confidential"), align="L")
        self.ln(3)
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            6,
            safe(f"Page {self.page_no()}  |  Training only - no passwords in this document  |  info@urbeno.in"),
            align="C",
        )


def fit_image(path: Path, max_w: float, max_h: float) -> tuple[float, float]:
    with Image.open(path) as im:
        w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    return w * scale, h * scale


def add_cover(pdf: TrainingPDF, data: dict):
    pdf.add_page()
    pdf.set_fill_color(*BG)
    pdf.rect(0, 0, pdf.w, pdf.h, "F")
    pdf.set_y(36)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*GREEN)
    pdf.multi_cell(pdf.epw, 11, "Urb TecTrack", align="C")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(*INK)
    pdf.multi_cell(pdf.epw, 8, safe(f"{data['roleLabel']} — Training Guide"), align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(pdf.epw, 5, safe(data.get("audience", "")), align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(10)
    mid = pdf.w / 2
    pdf.set_draw_color(*GREEN)
    pdf.line(mid - 40, pdf.get_y(), mid + 40, pdf.get_y())
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*INK)
    for line in [
        f"Portal:  {data.get('portal', 'https://uat.urbeno.in')}",
        "Sign-in:  issued separately by Urb TecTrack (not listed here)",
        "Support:  info@urbeno.in",
        "Format:  screenshot + detailed how-to for each step",
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 6, safe(line), align="C")
    pdf.set_x(pdf.l_margin)
    pdf.ln(12)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        pdf.epw,
        4.5,
        safe(
            "This guide is for classroom or self-paced training. Follow the numbered steps on each page. "
            "Tips call out common mistakes. Credentials are delivered by system email - never copy passwords into this PDF."
        ),
        align="C",
    )


def add_howto_toc(pdf: TrainingPDF, steps: list[dict]):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "How to use this training guide", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    bullets = [
        "Work through steps in order during a live training session or while practising on UAT.",
        "Each step has: What to do (numbered), Tips, and a full-page screenshot of the screen you should see.",
        "Pause after each step and confirm the Expected outcome before continuing.",
        "Ask your Urbeno facilitator to advance staff/factory actions when your role cannot perform them.",
        "Record questions in your notebook; report defects using the Client/Factory/Admin UAT results workbook.",
    ]
    for b in bullets:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 5, safe(f"- {b}"))
        pdf.ln(1)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "Training agenda", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    for i, step in enumerate(steps, start=1):
        pdf.set_x(pdf.l_margin)
        pdf.cell(16, 6, f"Step {i}")
        pdf.multi_cell(pdf.epw - 16, 6, safe(step["title"].split(" — ", 1)[-1] if " — " in step["title"] else step["title"]))


def add_step(pdf: TrainingPDF, index: int, step: dict, shots: Path):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*GREEN)
    title = step.get("title") or f"Step {index}"
    pdf.multi_cell(pdf.epw, 7, safe(title))
    pdf.ln(2)

    how = step.get("howTo") or step.get("notes") or ""
    if how:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*GREEN)
        pdf.cell(0, 6, "What to do", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*INK)
        for line in how.split("\n"):
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(pdf.epw, 4.4, safe(line))
        pdf.ln(2)

    tips = step.get("tips") or ""
    if tips:
        y0 = pdf.get_y()
        pdf.set_fill_color(*TIP_BG)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*INK)
        # Estimate tip box height roughly
        pdf.multi_cell(pdf.epw, 4.4, safe("Tip: " + tips), fill=True)
        pdf.ln(3)

    img = shots / step["file"]
    # Prefer jpg if present
    jpg = img.with_suffix(".jpg")
    path = jpg if jpg.exists() else img
    if not path.exists():
        pdf.set_text_color(180, 40, 40)
        pdf.cell(0, 8, f"(Screenshot missing: {step['file']})")
        return

    max_w = pdf.epw
    max_h = pdf.h - pdf.get_y() - 18
    if max_h < 40:
        pdf.add_page()
        max_h = pdf.h - pdf.get_y() - 18
    w, h = fit_image(path, max_w, max_h)
    x = pdf.l_margin + (max_w - w) / 2
    pdf.image(str(path), x=x, y=pdf.get_y(), w=w, h=h)


def compress_shots(shots: Path):
    for p in sorted(shots.glob("*.png")):
        im = Image.open(p).convert("RGB")
        w, h = im.size
        if w > 1400:
            im = im.resize((1400, int(h * 1400 / w)), Image.Resampling.LANCZOS)
        im.save(p.with_suffix(".jpg"), "JPEG", quality=82, optimize=True)


def build_role(role: str):
    role_dir = ROOT / role
    shots = role_dir / "screenshots"
    manifest = shots / "manifest.json"
    if not manifest.exists():
        raise SystemExit(f"Missing {manifest} — run capture-{role}.mjs first")

    data = json.loads(manifest.read_text())
    # Point files to jpg when available
    compress_shots(shots)
    for s in data["steps"]:
        jpg = Path(s["file"]).with_suffix(".jpg").name
        if (shots / jpg).exists():
            s["file"] = jpg

    pdf = TrainingPDF(data.get("roleLabel", role))
    add_cover(pdf, data)
    add_howto_toc(pdf, data["steps"])
    for i, step in enumerate(data["steps"], start=1):
        add_step(pdf, i, step, shots)

    out = role_dir / f"Urb-TecTrack-{role.capitalize()}-Training-Guide.pdf"
    # nicer names
    names = {
        "client": "Urb-TecTrack-Client-User-Training-Guide.pdf",
        "factory": "Urb-TecTrack-Factory-Manager-Training-Guide.pdf",
        "admin": "Urb-TecTrack-Admin-Training-Guide.pdf",
    }
    out = role_dir / names.get(role, out.name)
    pdf.output(str(out))
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB, {len(data['steps'])} steps)")
    return out


def main():
    roles = sys.argv[1:] or ["client", "factory", "admin"]
    for role in roles:
        build_role(role)


if __name__ == "__main__":
    main()
