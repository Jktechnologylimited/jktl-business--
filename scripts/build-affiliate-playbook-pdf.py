"""
Standalone, shareable PDF version of the JKTL affiliate playbook — condensed
so it fits comfortably in 2 pages and can be sent over WhatsApp today, to
the two interested people who don't have dashboard access yet.

Content is adapted (not copied) from general social-media-growth frameworks
into JKTL-specific, referral-focused language — same frameworks as the
in-app /affiliates/playbook page, condensed for a standalone hand-out.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, ListFlowable, ListItem
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

PRIMARY = colors.HexColor("#0F7A5C")   # JKTL-style green
INK = colors.HexColor("#1A1A1A")
INK_MUTED = colors.HexColor("#5B5B5B")
SOFT_BG = colors.HexColor("#EAF6F1")
BORDER = colors.HexColor("#E0E0E0")

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "TitleJKTL", parent=styles["Title"], textColor=PRIMARY, fontSize=20, leading=24, spaceAfter=2,
)
subtitle_style = ParagraphStyle(
    "SubtitleJKTL", parent=styles["Normal"], textColor=INK_MUTED, fontSize=10, leading=14, spaceAfter=10,
)
h2_style = ParagraphStyle(
    "H2JKTL", parent=styles["Heading2"], textColor=INK, fontSize=12.5, leading=15, spaceBefore=12, spaceAfter=6,
)
body_style = ParagraphStyle(
    "BodyJKTL", parent=styles["Normal"], textColor=INK, fontSize=9.3, leading=13.2,
)
muted_style = ParagraphStyle(
    "MutedJKTL", parent=styles["Normal"], textColor=INK_MUTED, fontSize=9, leading=12.8,
)
example_style = ParagraphStyle(
    "ExampleJKTL", parent=styles["Normal"], textColor=PRIMARY, fontSize=8.8, leading=12, spaceBefore=2,
)
fw_name_style = ParagraphStyle(
    "FwName", parent=styles["Normal"], textColor=INK, fontSize=10, leading=13, fontName="Helvetica-Bold",
)
footer_style = ParagraphStyle(
    "FooterJKTL", parent=styles["Normal"], textColor=INK_MUTED, fontSize=8, leading=11, alignment=TA_CENTER,
)

FRAMEWORKS = [
    ("Education", "Teach one small, specific thing.",
     "How to ___ in ___ minutes  ·  3 mistakes people make with ___",
     "“How to get your business a free website in 10 minutes”"),
    ("Authority", "Say something an owner wishes they'd been told sooner.",
     "Nobody tells you this about ___  ·  Stop doing this if you want ___",
     "“Nobody tells small business owners this: most of the software you need is free”"),
    ("Relatable", "A moment every Nigerian business owner recognises instantly.",
     "POV: you're a business owner and ___  ·  You know you run a small business when ___",
     "“POV: a customer asks 'do you have a website?' and you finally say yes”"),
    ("Storytelling", "A real before/after — yours, or a business you know.",
     "How [business] went from ___ to ___  ·  I tried ___ for 7 days, here's what happened",
     "“How this hair salon went from a WhatsApp catalogue to a real website in one week”"),
    ("List / value-packed", "Quick, save-able, shareable — these travel furthest.",
     "3 free tools every small business needs  ·  5 things to sort out before you open a shop",
     "“3 free tools every Nigerian small business needs in 2026”"),
    ("Pattern-break", "A confident, slightly contrarian claim — use sparingly.",
     "You don't need ___ to ___  ·  ___ is overrated (here's what actually works)",
     "“You don't need N500k to get your business online”"),
]

# JKTL's own official page links — fill these in with real URLs (e.g.
# ("Instagram", "https://instagram.com/jktlbusiness")) and rebuild to have
# them printed under "Follow & reshare us" below. Leave empty and that line
# is simply omitted rather than printing dead links.
SOCIAL_LINKS = [
    # ("Instagram", "https://instagram.com/..."),
    # ("TikTok", "https://tiktok.com/@..."),
    # ("Facebook", "https://facebook.com/..."),
    # ("WhatsApp Channel", "https://whatsapp.com/channel/..."),
]

CHALLENGE = [
    "Day 1 — Post one Education piece: a quick how-to.",
    "Day 2 — Post one Authority piece: something you wish you'd known.",
    "Day 3 — Post one Relatable piece: a business-owner moment.",
    "Day 4 — Post one Storytelling piece: a real before/after.",
    "Day 5 — Post one List piece: quick, save-able value.",
    "Day 6 — Post one Pattern-break piece: a confident, contrarian line.",
    "Day 7 — Count your clicks and sign-ups. Do more of whatever worked.",
]


def build():
    doc = SimpleDocTemplate(
        "jktl-affiliate-playbook.pdf",
        pagesize=A4,
        topMargin=16 * mm,
        bottomMargin=14 * mm,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        title="JKTL Affiliate Playbook",
        author="JKTL Business",
    )
    story = []

    story.append(Paragraph("JKTL Affiliate Playbook", title_style))
    story.append(Paragraph(
        "Your quick-start guide to earning recurring commission by referring small businesses to JKTL Business.",
        subtitle_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=8))

    # How you earn
    story.append(Paragraph("How this actually earns you money", h2_style))
    how_rows = [
        ["1", "Post content that gets attention.", "Doesn't need to be fancy — reshare ours (below) or use the 6 angles further down."],
        ["2", "Point people to your referral link.", "You'll get yours in your dashboard once approved. Mentioning jktl.com.ng — our main website — first builds trust before you drop it."],
        ["3", "Get paid for as long as they stay subscribed.", "One sign-up can pay you every month for years — not a one-time bounty."],
    ]
    how_table = Table(
        [[Paragraph(f"<b>{n}</b>", body_style), Paragraph(f"<b>{t}</b>", body_style), Paragraph(d, muted_style)] for n, t, d in how_rows],
        colWidths=[10 * mm, 55 * mm, 97 * mm],
    )
    how_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(how_table)

    # Welcome bonus
    story.append(Paragraph("Your N2,000 welcome bonus", h2_style))
    story.append(Paragraph(
        "On top of your regular commission, you get a one-time N2,000 bonus the moment your first referred business "
        "upgrades to a paid subscription — it just lands in your balance. Once approved, add your (Paystack-verified) "
        "bank details in your dashboard, then request a payout from the 21st of each month.",
        muted_style,
    ))

    # Follow & reshare — the fastest content there is
    story.append(Paragraph("The fastest content: follow &amp; reshare us", h2_style))
    reshare_text = (
        "Before you make anything of your own, follow JKTL's official pages and reshare what we post — to your "
        "WhatsApp Status, as a Reel share, a retweet. It costs no creativity and keeps your feed consistent with the "
        "brand you're representing. Do this alongside your own posts, not instead of them."
    )
    if SOCIAL_LINKS:
        links_line = "  ·  ".join(f'<link href="{url}" color="#0F7A5C">{name}</link>' for name, url in SOCIAL_LINKS)
        reshare_text += f"<br/><br/>{links_line}"
    story.append(Paragraph(reshare_text, muted_style))

    # Two ways to show up
    story.append(Paragraph("Two ways to show up", h2_style))
    two_ways = Table(
        [[
            Paragraph("<b>Face content</b><br/>You on camera, talking or explaining. Builds trust faster.", muted_style),
            Paragraph("<b>Faceless content</b><br/>Text-on-screen, voiceover, screenshots. Easier to start.", muted_style),
        ]],
        colWidths=[81 * mm, 81 * mm],
    )
    two_ways.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BG),
        ("BOX", (0, 0), (0, 0), 0, colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(two_ways)

    # 6 frameworks
    story.append(Paragraph("6 angles that work — pick one at a time", h2_style))
    fw_data = []
    for name, desc, templates, example in FRAMEWORKS:
        cell = [
            Paragraph(name, fw_name_style),
            Paragraph(desc, muted_style),
            Paragraph(f"<i>{templates}</i>", muted_style),
            Paragraph(f"Example: {example}", example_style),
        ]
        fw_data.append([cell])
    fw_table = Table(fw_data, colWidths=[162 * mm])
    fw_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("LINEBELOW", (0, 0), (-1, -2), 0.6, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(fw_table)

    # Where to post
    story.append(Paragraph("Where to post", h2_style))
    where = [
        ("TikTok / Instagram Reels", "Hook in the first 2 seconds, keep it under 60 seconds, post consistently. Link in bio."),
        ("Facebook", "Reaches an older, business-owner-heavy audience — good for explainer posts and small-business groups."),
        ("WhatsApp Status", "Your most direct channel — no algorithm. A short caption and your link, shared daily."),
    ]
    where_table = Table(
        [[Paragraph(f"<b>{n}</b>", body_style), Paragraph(d, muted_style)] for n, d in where],
        colWidths=[45 * mm, 117 * mm],
    )
    where_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(where_table)

    # 7-day challenge
    story.append(Paragraph("Your 7-day launch challenge", h2_style))
    story.append(Paragraph(
        "One post a day, one angle a day. By day 7 you'll know which angle fits you best.", muted_style,
    ))
    story.append(Spacer(1, 4))
    challenge_items = [ListItem(Paragraph(c, body_style), bulletColor=PRIMARY) for c in CHALLENGE]
    story.append(ListFlowable(challenge_items, bulletType="bullet", start="•", leftIndent=10))

    # Getting started footer box
    story.append(Spacer(1, 10))
    gs = Table(
        [[Paragraph(
            "<b>Getting started:</b> reply to whoever shared this with you, or apply directly in the JKTL Business "
            "app under Affiliates → Apply. Once approved, your unique referral link and earnings dashboard "
            "will be waiting for you.",
            body_style,
        )]],
        colWidths=[162 * mm],
    )
    gs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(gs)

    story.append(Spacer(1, 10))
    story.append(Paragraph("JKTL Business — Affiliate Program", footer_style))

    doc.build(story)


if __name__ == "__main__":
    build()
