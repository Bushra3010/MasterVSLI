"""Write the YouTube video sections into the website pages from videos.json.

Run after editing videos.json:  python3 website/build-videos.py
Each section sits between <!--videos:NAME:start--> and <!--videos:NAME:end--> markers, so re-running replaces it.
"""
import html
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "src")
data = json.load(open(os.path.join(HERE, "videos.json"), encoding="utf-8"))
VIDEOS = data["videos"]
CHANNEL = data["channel"]
esc = html.escape


def card(v, extra=False):
    label = f"Play video: {v['name']} — {v['detail']}"
    return (
        f'<li class="vcard{" is-extra" if extra else ""}">'
        f'<a class="vthumb" href="https://www.youtube.com/shorts/{v["id"]}" target="_blank" rel="noopener noreferrer" data-yt="{v["id"]}" aria-label="{esc(label)}">'
        f'<img src="https://i.ytimg.com/vi/{v["id"]}/oar2.jpg" alt="" loading="lazy" width="270" height="480"/>'
        f'<span class="vplay" aria-hidden="true"></span>'
        f'{"<span class=vbadge>Placed</span>" if v["kind"] == "placed" else ""}'
        f"</a>"
        f'<div class="vmeta"><span class="vname">{esc(v["name"])}</span><span class="vdetail">{esc(v["detail"])}</span></div>'
        f"</li>"
    )


def head(eyebrow, title, lede):
    return (
        '<div class="flex flex-col items-center text-center mb-10 lg:mb-12">'
        f'<p class="eyebrow">{eyebrow}</p><h2 class="display t-1 mt-4 max-w-3xl">{title}</h2>'
        f'<p class="lede muted mt-4 max-w-2xl">{lede}</p></div>'
    )


def channel_btn(extra=""):
    return f'<a class="btn btn-ghost" href="{CHANNEL}" target="_blank" rel="noopener noreferrer">Watch all on YouTube ↗</a>{extra}'


placed = [v for v in VIDEOS if v["kind"] == "placed"]
tour = [v for v in VIDEOS if v["kind"] == "tour"]
reviews = [v for v in VIDEOS if v["kind"] == "review"]

SECTIONS = {
    # Home: success stories, like a testimonial strip.
    "home": (
        "index.html",
        "Start learning before you enrol.",
        '<section class="on-light section" id="success-stories" aria-labelledby="stories-title"><div class="wrap">'
        + head("Success stories", '<span id="stories-title">Real students. Real offers. <span class="text-volt">On camera.</span></span>',
               "Hear it straight from MasterVLSI students — where they started, how they trained, and where they were placed.")
        + '<ul class="vgrid">' + "".join(card(v) for v in placed + tour) + "</ul>"
        + '<div class="vactions">' + channel_btn('<a class="btn btn-primary" href="/placements#videos">See all student videos →</a>') + "</div>"
        + "</div></section>",
    ),
    # Placements: the full library — placed students first, then student reviews (first rows shown, the rest behind "Show more").
    "placements": (
        "placements/index.html",
        "Hear it from alumni, unscripted.",
        '<section class="on-light section" id="videos" aria-labelledby="videos-title"><div class="wrap">'
        + head("Student videos", f'<span id="videos-title">{len(placed) + len(reviews)} students, <span class="text-volt">in their own words.</span></span>',
               "Placed alumni and current students from colleges across Karnataka and beyond talk about their training at MasterVLSI.")
        + '<h3 class="t-3 mb-4">Placed students</h3><ul class="vgrid">' + "".join(card(v) for v in placed) + "</ul>"
        + '<h3 class="t-3 mt-12 mb-4">Student reviews</h3><ul class="vgrid" data-more-list="">'
        + "".join(card(v, extra=i >= 10) for i, v in enumerate(reviews)) + "</ul>"
        + '<div class="vactions">'
        + (f'<button type="button" class="btn btn-primary" data-more="" hidden="">Show all {len(reviews)} student reviews</button>' if len(reviews) > 10 else "")
        + channel_btn() + "</div></div></section>",
    ),
    # Campus: the office & lab tour.
    "campus": (
        "campus/index.html",
        "Come and see the lab.",
        '<section class="on-light section" id="tour" aria-labelledby="tour-title"><div class="wrap vtour">'
        + '<div><p class="eyebrow">Video tour</p><h2 class="display t-1 mt-4" id="tour-title">Walk through the <span class="text-volt">office and lab.</span></h2>'
        + '<p class="lede muted mt-4">A quick look at the MasterVLSI training floor in Udayanagar, Bangalore — classrooms, the 24/7 lab and where you will spend your cohort.</p>'
        + '<div class="vactions vactions-left"><a class="btn btn-primary" href="/demo">Book a free demo →</a>' + channel_btn() + "</div></div>"
        + '<ul class="vgrid vgrid-single">' + "".join(card(v) for v in tour) + "</ul>"
        + "</div></section>",
    ),
}

for name, (page, before_heading, section) in SECTIONS.items():
    path = os.path.join(PUBLIC, page)
    src = open(path, encoding="utf-8").read()
    start, end = f"<!--videos:{name}:start-->", f"<!--videos:{name}:end-->"
    block = start + section + end
    if start in src:
        src = re.sub(re.escape(start) + r"[\s\S]*?" + re.escape(end), lambda _: block, src)
    else:
        i = src.find(before_heading)
        assert i >= 0, f"{page}: heading not found: {before_heading}"
        s = src.rfind("<section", 0, i)
        src = src[:s] + block + src[s:]
    open(path, "w", encoding="utf-8").write(src)
    print(f"{page}: {name} section written")
