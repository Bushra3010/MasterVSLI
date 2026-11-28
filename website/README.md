# MasterVLSI website

The public website (Courses, Placements, Campus, Fees, Corporate, Resources, About, Contact, Book a free demo),
served as static pages by Cloudflare.

- **Edit** pages in `src/<page>/index.html` (home is `src/index.html`), styles in `src/assets/site.css` and
  `src/assets/extra.css`, and the script in `src/assets/site.js` (mobile menu, animations, course filter,
  WhatsApp enquiry forms to **+91 90192 32425**, video player, link prefetching).
- **Videos:** edit `videos.json`, then run `python3 website/build-videos.py` to update the Home, Placements and Campus video sections.
- **Build** the fast version into `dist/` (styles inlined, WebP images, versioned files, year-long caching):

      PATH=$HOME/.local/node22/bin:$PATH node website/build.mjs

- **Preview** the built site: `node website/serve.mjs` → http://127.0.0.1:4321
- **Deploy** (after building):

      cd website && npx wrangler deploy

`dist/` is generated — never edit it by hand.
