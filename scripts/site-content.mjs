import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import path from "node:path";

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const words = (fr, en, language) => (language === "fr" ? fr : en);
const anchor = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Authored manual subset only: literal prose, headings, lists, links, emphasis and fenced code. */
export function renderMarkdown(source) {
  const inline = (text) => {
    let end = 0,
      out = "";
    for (const match of text.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\)/g)) {
      out += escapeHtml(text.slice(end, match.index));
      if (match[1]) out += `<code>${escapeHtml(match[1])}</code>`;
      else if (match[2]) out += `<strong>${escapeHtml(match[2])}</strong>`;
      else {
        const href = match[4].replace(/\.md(?=#|$)/, ".html");
        if (!/^(https:\/\/|[a-zA-Z0-9.#/][^:]*$)/.test(href) || href.startsWith("//"))
          throw Error(`Unsupported manual link: ${href}`);
        out += `<a href="${escapeHtml(href)}">${escapeHtml(match[3])}</a>`;
      }
      end = match.index + match[0].length;
    }
    return out + escapeHtml(text.slice(end));
  };
  let html = "",
    paragraph = [],
    list = [],
    listType = "",
    code = null;
  const headings = [],
    used = new Map();
  const flush = () => {
    if (paragraph.length) html += `<p>${inline(paragraph.join(" "))}</p>\n`;
    if (list.length)
      html += `<${listType}>${list.map((line) => `<li>${inline(line)}</li>`).join("")}</${listType}>\n`;
    paragraph = [];
    list = [];
    listType = "";
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      flush();
      if (code === null) code = [];
      else {
        html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>\n`;
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,4}) (.+)$/.exec(line);
    if (heading) {
      flush();
      if (heading[1].length === 1) continue;
      const base = anchor(heading[2]),
        count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const id = base + (count ? `-${count + 1}` : "");
      headings.push({ level: heading[1].length, id, title: heading[2] });
      html += `<h${heading[1].length} id="${id}">${inline(heading[2])}</h${heading[1].length}>\n`;
    } else if (!line.trim()) flush();
    else {
      const item = /^(- |\d+\. )(.+)$/.exec(line);
      if (item) {
        const type = item[1] === "- " ? "ul" : "ol";
        if (paragraph.length || (listType && listType !== type)) flush();
        listType = type;
        list.push(item[2]);
      } else {
        if (list.length) flush();
        paragraph.push(line);
      }
    }
  }
  if (code !== null) throw Error("Unclosed manual code fence");
  flush();
  return { html, headings };
}

export function siteHeader(language, prefix, manual = false, slug = "index") {
  const home = prefix + (language === "en" ? "en/" : "");
  const guide = manual ? "index.html" : prefix + `docs/${language}/index.html`;
  const counterpart = manual
    ? `../${language === "fr" ? "en" : "fr"}/${slug}.html`
    : prefix + (language === "fr" ? "en/" : "index.html");
  return `<a class="skip" href="#main">${words("Aller au contenu", "Skip to content", language)}</a><header class="site-header"><a href="${home}" aria-label="Phémios"><img src="${prefix}assets/phemios-wordmark.svg" width="145" height="48" alt="Phémios"></a><nav aria-label="${words("Navigation principale", "Main navigation", language)}"><a href="${home}#library">${words("Découvrir", "Discover", language)}</a><a href="${guide}" ${manual ? 'aria-current="page"' : ""}>${words("Manuel", "Manual", language)}</a><a href="${prefix}components/index.html">Storybook <span aria-hidden="true">↗</span></a></nav><div class="languages" aria-label="${words("Langue", "Language", language)}"><a href="${language === "fr" ? (manual ? `${slug}.html` : home) : counterpart}" lang="fr" ${language === "fr" ? 'aria-current="page"' : ""}>FR</a><span aria-hidden="true">/</span><a href="${language === "en" ? (manual ? `${slug}.html` : home) : counterpart}" lang="en" ${language === "en" ? 'aria-current="page"' : ""}>EN</a></div></header>`;
}
export function siteFooter(language, prefix) {
  return `<footer class="site-footer"><div><img src="${prefix}assets/phemios-wordmark.svg" width="120" height="40" alt="Phémios"><p>${words("Votre musique reste à vous.", "Your music stays yours.", language)}</p></div><nav aria-label="${words("Ressources", "Resources", language)}"><a href="${prefix}docs/${language}/index.html">${words("Manuel utilisateur", "User manual", language)}</a><a href="${prefix}rust/phemios_core/index.html">Rustdoc</a><a href="${prefix}components/index.html">Storybook</a><a href="${prefix}typescript/index.html">TypeScript</a></nav><small>MPL-2.0 · 2026</small></footer>`;
}
export function htmlPage(language, title, description, prefix, body, extra = "") {
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — Phémios</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#121314"><meta property="og:title" content="${escapeHtml(title)} — Phémios"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><link rel="icon" href="${prefix}assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${prefix}styles.css">${extra}</head><body>${body}</body></html>`;
}

/** Pure static publication: source Markdown stays separate from application/technical outputs. */
export async function generateSite(root, output) {
  await mkdir(output, { recursive: true });
  await cp(path.join(root, "site"), output, {
    recursive: true,
    filter: (file) => !file.endsWith("README.md"),
  });
  const pages = JSON.parse(await readFile(path.join(root, "docs/manual/manifest.json"), "utf8"));
  for (const language of ["fr", "en"]) {
    const folder = path.join(output, "docs", language);
    await mkdir(folder, { recursive: true });
    const prefix = "../../",
      choose = (fr, en) => words(fr, en, language);
    const navigation = (active) =>
      `<aside class="manual-sidebar"><details open><summary>${choose("Chapitres du manuel", "Manual chapters")}</summary><label for="manual-search">${choose("Trouver un chapitre", "Find a chapter")}</label><input id="manual-search" type="search" placeholder="${choose("Ex. : paroles, dossiers…", "E.g. lyrics, folders…")}" aria-controls="manual-chapters"><p class="search-status" aria-live="polite"></p><nav id="manual-chapters" aria-label="${choose("Chapitres", "Chapters")}"><a href="index.html" ${active === "index" ? 'aria-current="page"' : ""}>${choose("Vue d’ensemble", "Overview")}</a>${pages.map((p, i) => `<a href="${p.slug}.html" data-search="${escapeHtml(p.title[language] + " " + p.description[language])}" ${active === p.slug ? 'aria-current="page"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${escapeHtml(p.title[language])}</a>`).join("")}</nav></details></aside>`;
    for (const [index, page] of pages.entries()) {
      const source = await readFile(
        path.join(root, "docs/manual", language, page.slug + ".md"),
        "utf8",
      );
      const rendered = renderMarkdown(source);
      const previous = pages[index - 1],
        next = pages[index + 1];
      const paging = `<nav class="manual-paging" aria-label="${choose("Parcourir le manuel", "Browse the manual")}">${previous ? `<a href="${previous.slug}.html"><small>← ${choose("Précédent", "Previous")}</small>${escapeHtml(previous.title[language])}</a>` : "<span></span>"}${next ? `<a href="${next.slug}.html"><small>${choose("Suivant", "Next")} →</small>${escapeHtml(next.title[language])}</a>` : '<a href="index.html">↑ ' + choose("Tous les chapitres", "All chapters") + "</a>"}</nav>`;
      const body =
        siteHeader(language, prefix, true, page.slug) +
        `<div class="manual-layout">${navigation(page.slug)}<main id="main" class="manual-content"><p class="eyebrow">${choose("MANUEL UTILISATEUR", "USER MANUAL")} · ${String(index + 1).padStart(2, "0")} / ${pages.length}</p><h1>${escapeHtml(page.title[language])}</h1><p class="manual-lead">${escapeHtml(page.description[language])}</p><article>${rendered.html}</article>${paging}<p class="manual-footnote">${choose("Les noms des commandes peuvent varier si vous avez personnalisé votre navigation.", "Control names may differ if you customized your navigation.")}</p></main><aside class="manual-toc"><p>${choose("Sur cette page", "On this page")}</p>${rendered.headings
          .filter((h) => h.level === 2)
          .map((h) => `<a href="#${h.id}">${escapeHtml(h.title)}</a>`)
          .join(
            "",
          )}<a class="back-top" href="#main">↑ ${choose("En haut", "Top")}</a></aside></div>` +
        siteFooter(language, prefix);
      await writeFile(
        path.join(folder, page.slug + ".html"),
        htmlPage(
          language,
          page.title[language],
          page.description[language],
          prefix,
          body,
          '<link rel="stylesheet" href="../../manual.css"><script src="../../manual.js" defer></script>',
        ),
      );
    }
    const cards = pages
      .map(
        (p, i) =>
          `<a class="manual-card" href="${p.slug}.html"><span class="number">${String(i + 1).padStart(2, "0")} /</span><h2>${escapeHtml(p.title[language])}<span aria-hidden="true">↗</span></h2><p>${escapeHtml(p.description[language])}</p></a>`,
      )
      .join("");
    const body =
      siteHeader(language, prefix, true) +
      `<div class="manual-layout manual-index">${navigation("index")}<main id="main" class="manual-content"><p class="eyebrow">${choose("LE GUIDE PHÉMIOS", "THE PHÉMIOS GUIDE")}</p><h1>${choose("Faites place<br>à votre musique.", "Make room<br>for your music.")}</h1><p class="manual-lead">${choose("De votre premier dossier à votre prochaine découverte. Ce manuel vous accompagne dans l’App, à votre rythme.", "From your first folder to your next discovery. This manual guides you through the App, at your own pace.")}</p><a class="primary" href="getting-started.html">${choose("Commencer ici", "Start here")} <span aria-hidden="true">→</span></a><div class="manual-cards">${cards}</div><section class="manual-boundaries"><h2>${choose("Le bon guide, au bon endroit.", "The right guide in the right place.")}</h2><p>${choose("Ce manuel explique l’interface et vos parcours. Les détails du moteur appartiennent à Aède ; l’interprétation des analyses, à FlacCompagnon.", "This manual explains the interface and your workflows. Engine details belong to Aède; analysis interpretation belongs to FlacCompagnon.")}</p><a href="https://craft-and-code.github.io/aede/docs/${language}/index.html">${choose("Manuel Aède", "Aède manual")} ↗</a><a href="https://craft-and-code.github.io/FlacCompagnon/">FlacCompagnon ↗</a><h3>${choose("Explorer la fabrication", "Explore how it is made")}</h3><p>${choose("Les composants interactifs utilisent des données fictives : ils ne lisent ni ne modifient votre bibliothèque.", "Interactive components use fictional data: they neither read nor change your library.")}</p><a href="../../components/index.html">Storybook ↗</a><a href="../../rust/phemios_core/index.html">Rustdoc ↗</a><a href="../../typescript/index.html">${choose("Contrats TypeScript", "TypeScript contracts")} ↗</a></section></main></div>` +
      siteFooter(language, prefix);
    await writeFile(
      path.join(folder, "index.html"),
      htmlPage(
        language,
        choose("Manuel utilisateur", "User manual"),
        choose(
          "Le guide de Phémios : bibliothèques, lecture, paroles, collections et personnalisation.",
          "The Phémios guide: libraries, playback, lyrics, collections and customization.",
        ),
        prefix,
        body,
        '<link rel="stylesheet" href="../../manual.css"><script src="../../manual.js" defer></script>',
      ),
    );
  }
  return pages;
}
