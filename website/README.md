# MasterVLSI website

The public website (Courses, Placements, Campus, Fees, Corporate, Resources, About, Contact, Book a free demo),
served as static pages by Cloudflare.

- Pages: `public/<page>/index.html` (home is `public/index.html`). Edit the HTML directly.
- Styles: `public/assets/site.css` (original) and `public/assets/extra.css` (logo, mobile menu, form note).
- Script: `public/assets/site.js` — mobile menu, scroll animations, course filter, and the enquiry forms,
  which open WhatsApp to **+91 90192 32425** with the message filled in.
- Logo: `public/assets/logo-official.png` (same file as the ERP).

Preview locally:

    cd website/public && python3 -m http.server 4321

Deploy (from the repository root):

    cd website && npx wrangler deploy
