# Phémios website

A static French/English introduction, kept separate from the desktop bundle. It uses local SVG brand assets, fictional CSS artwork, system fonts and no framework, analytics, cookies or external asset requests. The illustration is explicitly labelled as a stylised preview. Public download/repository/deployment URLs are intentionally absent until a publication destination and release exist. External project links open Aède and FlacCompagnon.

Preview from the repository root with `python3 -m http.server 1439 --bind 127.0.0.1 --directory site`, then open `http://127.0.0.1:1439/`. The English counterpart is `/en/`. Both pages are source files; update them together. `npm test` checks local assets, anchors, locale parity and project links. The regular `tools/check.sh` remains the commit gate. Website publication is a separate user-authorised step.
