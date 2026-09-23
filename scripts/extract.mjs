import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const oldDir = path.join(root, "old");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "src", "data");
const siteOrigin = "https://kololowieckieprzepiorka.pl";

const LETTERS = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "a",
  Ć: "c",
  Ę: "e",
  Ł: "l",
  Ń: "n",
  Ó: "o",
  Ś: "s",
  Ź: "z",
  Ż: "z",
};

const KNOWN_ALT = {
  "images/St_Hubert.jpg": "Święty Hubert",
  "images/DSC_4815.jpg": "Członkowie Koła Łowieckiego Przepiórka ze sztandarem",
  "images/Kl_przepiorka_70lat.png": "Znak 70-lecia Koła Łowieckiego Przepiórka",
  "images/Kl_przepiorka_70lat_p.png": "Znak 70-lecia Koła Łowieckiego Przepiórka",
  "images/image001.png": "Elektroniczna ewidencja polowań EPI24",
};

function slugify(input) {
  let value = [...String(input)].map((char) => LETTERS[char] ?? char).join("");
  value = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  value = value.toLowerCase().replace(/&/g, " i ");
  value = value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return value;
}

function uniqueSlug(base, used) {
  let slug = base || "strona";
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function readHtml(file) {
  return fs.readFileSync(path.join(oldDir, file), "utf8");
}

function imageDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      const size = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + size;
    }
  }
  return {};
}

function copyAsset(relativePath, destination) {
  const source = path.join(oldDir, relativePath);
  if (!fs.existsSync(source)) return null;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const dims = imageDimensions(source);
  return { file: destination, ...dims };
}

function resolveImage(relativePath) {
  const clean = relativePath.replace(/^\//, "");
  if (fs.existsSync(path.join(oldDir, clean))) return clean;
  const thumb = clean.replace(/\.(jpe?g|png|webp)$/i, "_thumb.png");
  if (thumb !== clean && fs.existsSync(path.join(oldDir, thumb))) return thumb;
  return null;
}

function publicImage(relativePath) {
  const clean = resolveImage(relativePath);
  if (!clean) {
    console.warn(`missing ${relativePath}`);
    return null;
  }
  const destRel = path.posix.join("/media", clean);
  const copied = copyAsset(clean, path.join(publicDir, destRel));
  if (!copied) return null;
  return {
    src: destRel,
    width: copied.width ?? null,
    height: copied.height ?? null,
    alt: KNOWN_ALT[relativePath.replace(/^\//, "")] || KNOWN_ALT[clean] || "",
  };
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function cleanLabel(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^(do pobrania|dokument do pobrania|dokumenty do pobrania|plik do pobrania)\s*[:\-–]?\s*/i, "")
    .replace(/\.pdf$/i, "")
    .trim();
}

function isGenericLabel(text) {
  const value = cleanLabel(text).toLowerCase();
  if (value.length < 8) return true;
  return /^(plik|dokument|pobierz|pobieranie|do pobrania)$/.test(value);
}

function extractMedia(html) {
  const photos = [];
  const chunks = html.split(/\{['"]?type['"]?\s*:\s*['"]image['"]/);
  for (const chunk of chunks.slice(1)) {
    const slice = chunk.slice(0, 700);
    const url = slice.match(/(?:^|[^a-zA-Z])url['"]?\s*:\s*['"]([^'"]+)['"]/)?.[1];
    if (!url || url.includes("_thumb") || /b14_[lr]\.png$/.test(url)) continue;
    const width = Number(slice.match(/['"]?width['"]?\s*:\s*(\d+)/)?.[1] || 0) || null;
    const height = Number(slice.match(/['"]?height['"]?\s*:\s*(\d+)/)?.[1] || 0) || null;
    const description = slice.match(/['"]description['"]\s*:\s*['"]((?:\\.|[^'"\\])*)['"]/)?.[1] || "";
    photos.push({ url, width, height, description });
  }
  return photos;
}

function menuAlbums() {
  const $ = cheerio.load(readHtml("index.html"));
  const albums = [];
  $("#imMnMnNode9 ul a").each((_, anchor) => {
    const href = $(anchor).attr("href");
    const title = $(anchor).find(".imMnMnTextLabel").text().replace(/\s+/g, " ").trim();
    if (href && title) albums.push({ href, title });
  });
  return albums;
}

function albumFromFile(file, fallbackTitle) {
  const html = readHtml(file);
  const $ = cheerio.load(html);
  const title = $("#imPgTitle").first().text().replace(/\s+/g, " ").trim() || fallbackTitle;
  let photos = extractMedia(html);
  if (photos.length === 0) {
    $("#imContent img").each((_, img) => {
      const src = $(img).attr("src") || "";
      if (!src || /LINE/i.test(src) || src.includes("_thumb")) return;
      photos.push({
        url: src,
        width: null,
        height: null,
        description: $(img).attr("alt") || $(img).attr("title") || "",
      });
    });
  }
  return { title, photos };
}

const MONTHS = {
  stycznia: "01",
  lutego: "02",
  marca: "03",
  kwietnia: "04",
  maja: "05",
  czerwca: "06",
  lipca: "07",
  sierpnia: "08",
  września: "09",
  wrzesnia: "09",
  października: "10",
  pazdziernika: "10",
  listopada: "11",
  grudnia: "12",
};

function dateFromText(text) {
  const head = text.slice(0, 280);
  const found = [];
  for (const match of head.matchAll(/(\d{1,2})\.(\d{2})\.(\d{4})/g)) {
    found.push({ index: match.index, day: match[1], month: match[2], year: match[3] });
  }
  for (const match of head.matchAll(/(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia)\s+(\d{4})/gi)) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) found.push({ index: match.index, day: match[1], month, year: match[3] });
  }
  found.sort((a, b) => a.index - b.index);
  const match = found[0];
  if (!match) return null;
  const day = match.day.padStart(2, "0");
  const iso = `${match.year}-${match.month}-${day}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    iso,
    label: new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed),
  };
}

function firstSentence(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean.split(/(?<=[.!?])\s+/);
  let sentence = "";
  for (const part of parts) {
    sentence = sentence ? `${sentence} ${part}` : part;
    if (sentence.length >= 40 && /[.!?]$/.test(part)) break;
  }
  if (sentence.length <= 140) return sentence;
  return sentence.slice(0, 130).replace(/\s+\S*$/, "");
}

function clipTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 110) return clean.replace(/[.,;:\-–]+$/, "");
  return clean.slice(0, 110).replace(/\s+\S*$/, "").replace(/[.,;:\-–]+$/, "");
}

function deriveTitle(html) {
  const $ = cheerio.load(html);
  $("div, p, br, li").each((_, el) => {
    $(el).before(" ");
  });
  const plain = $.root()
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d{1,2}\.\d{2}\.\d{4}\s*/, "")
    .replace(/^\d{1,2}\s+[^\d]+\d{4}\s*/, "");
  if (plain.includes("Zdzisław Henryk Siłkowski")) return "Zdzisław Henryk Siłkowski";
  return clipTitle(firstSentence(plain || "Aktualność"));
}

function limitSlug(slug) {
  if (slug.length <= 72) return slug;
  const cut = slug.slice(0, 72);
  const hyphen = cut.lastIndexOf("-");
  return (hyphen > 24 ? cut.slice(0, hyphen) : cut).replace(/-+$/, "");
}

function safeHref(href, fileMap) {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("files/")) {
    const filename = decodeURIComponent(trimmed.slice("files/".length).split(/[?#]/)[0]);
    return fileMap.get(filename) || null;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("mailto:")) return trimmed;
  if (trimmed.startsWith("/pliki/") || trimmed.startsWith("/media/")) return trimmed;
  return null;
}

function inlineFrom(node, $, fileMap) {
  if (node.type === "text") return escapeText(node.data).replace(/\u00a0/g, " ");
  if (node.type !== "tag") return "";
  const name = node.name;
  if (name === "br") return "\n";
  if (name === "img") return "";
  if (name === "a") {
    const href = safeHref($(node).attr("href"), fileMap);
    const label = $(node).contents().toArray().map((child) => inlineFrom(child, $, fileMap)).join("").replace(/\s+/g, " ").trim();
    if (!href || !label) return label;
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeAttr(href)}"${external}>${label}</a>`;
  }
  if (name === "b" || name === "strong" || name === "i" || name === "em") {
    const tag = name === "i" || name === "em" ? "em" : "strong";
    const inner = $(node).contents().toArray().map((child) => inlineFrom(child, $, fileMap)).join("");
    return inner
      .split("\n")
      .map((part) => (part.trim() ? `<${tag}>${part}</${tag}>` : ""))
      .join("\n");
  }
  return $(node).contents().toArray().map((child) => inlineFrom(child, $, fileMap)).join("");
}

function blocksFrom(el, $, fileMap) {
  const blocks = [];
  let buffer = [];
  const flush = () => {
    const html = buffer.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
    buffer = [];
    if (!html) return;
    for (const part of html.split("\n")) {
      const paragraph = part.replace(/\s+/g, " ").trim();
      if (paragraph && paragraph !== "&nbsp;" && !/^_+$/.test(paragraph.replace(/&nbsp;/g, ""))) {
        blocks.push(`<p>${paragraph}</p>`);
      }
    }
  };
  for (const node of $(el).contents().toArray()) {
    if (node.type === "tag" && node.name === "img") {
      flush();
      const src = $(node).attr("src") || "";
      if (src && !/LINE/i.test(src)) {
        const image = publicImage(src);
        if (image) {
          const alt = $(node).attr("alt") || $(node).attr("title") || "";
          const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
          blocks.push(`<img src="${escapeAttr(image.src)}" alt="${escapeAttr(alt)}"${size} loading="lazy">`);
        }
      }
      continue;
    }
    if (node.type === "tag" && ["div", "p", "blockquote", "ul", "ol", "li", "header"].includes(node.name)) {
      if ($(node).find("div, p, blockquote, ul, ol, table").length) {
        flush();
        blocks.push(...blocksFrom(node, $, fileMap));
      } else {
        buffer.push(inlineFrom(node, $, fileMap));
        buffer.push("\n");
      }
      continue;
    }
    buffer.push(inlineFrom(node, $, fileMap));
  }
  flush();
  return blocks;
}

function excerptFrom(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  const text = $("div").text().replace(/\s+/g, " ").trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 220).replace(/\s+\S*$/, "")}…`;
}

function collectFileUses(cells) {
  const uses = new Map();
  for (const cell of cells) {
    const $ = cheerio.load(`<div id="root">${cell.html}</div>`);
    $("#root a").each((_, anchor) => {
      const href = $(anchor).attr("href") || "";
      if (!href.startsWith("files/")) return;
      const filename = decodeURIComponent(href.slice("files/".length).split(/[?#]/)[0]);
      const label = cleanLabel($(anchor).text());
      const current = uses.get(filename) || [];
      current.push({ label, title: cell.title });
      uses.set(filename, current);
    });
  }
  return uses;
}

function newsCells() {
  const $ = cheerio.load(readHtml("aktualnosci.php"));
  const cells = [];
  let pendingImage = null;
  $("#imContent [id^='imCell_']").each((_, cell) => {
    const textEl = $(cell).find(".text-inner").first();
    if (textEl.length) {
      const raw = textEl.text().replace(/\s+/g, " ").trim();
      const compact = raw.replace(/\s/g, "");
      if (!raw || /^_+$/.test(compact)) return;
      const html = $.html(textEl);
      const date = dateFromText(raw);
      const title = deriveTitle(html);
      cells.push({ html, title, date, image: pendingImage, order: cells.length });
      pendingImage = null;
      return;
    }
    const img = $(cell).find("img").first();
    const src = img.attr("src") || "";
    if (src && !/LINE/i.test(src)) pendingImage = publicImage(src);
  });
  return cells;
}

function redirectPage(target) {
  const absolute = new URL(target, siteOrigin).href;
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <title>Przekierowanie — Koło Łowieckie „Przepiórka”</title>
  <link rel="canonical" href="${absolute}">
  <meta http-equiv="refresh" content="0; url=${target}">
  <script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
  <p><a href="${target}">Przejdź do nowej strony</a></p>
</body>
</html>
`;
}

function writeRedirect(filename, target) {
  const destination = path.join(publicDir, filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, redirectPage(target));
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const logo = publicImage("style/logo_przepiorka_500x500.png");
fs.copyFileSync(path.join(oldDir, "favicon.ico"), path.join(publicDir, "favicon.ico"));

const homeImages = ["images/St_Hubert.jpg", "images/DSC_4815.jpg"].map(publicImage).filter(Boolean);
const marks = ["images/Kl_przepiorka_70lat.png", "images/Kl_przepiorka_70lat_p.png"].map(publicImage).filter(Boolean);
const epiImage = publicImage("images/image001.png");

const albumSlugs = new Set();
const albums = menuAlbums().map((item) => {
  const extracted = albumFromFile(item.href, item.title);
  const title = item.title.replace(/\s+/g, " ").trim();
  const slug = uniqueSlug(limitSlug(slugify(title)), albumSlugs);
  const photos = [];
  for (const [index, photo] of extracted.photos.entries()) {
    const copied = publicImage(photo.url);
    if (!copied) continue;
    photos.push({
      src: copied.src,
      width: photo.width || copied.width,
      height: photo.height || copied.height,
      alt: photo.description || `${title}, zdjęcie ${index + 1}`,
    });
  }
  return {
    slug,
    title,
    source: item.href,
    cover: photos[0] || null,
    photos,
  };
});

const cells = newsCells();
const fileUses = collectFileUses(cells);
const fileMap = new Map();
const fileSlugs = new Set();
for (const [filename, labels] of fileUses) {
  const source = path.join(oldDir, "files", filename);
  if (!fs.existsSync(source)) {
    console.warn(`missing file ${filename}`);
    continue;
  }
  const best = labels
    .map((item) => cleanLabel(item.label))
    .filter((label) => label && !isGenericLabel(label))
    .sort((a, b) => b.length - a.length)[0];
  const fallback = labels[0]?.title || path.parse(filename).name;
  const ext = path.extname(filename).toLowerCase() || "";
  const base = slugify(best || fallback) || slugify(path.parse(filename).name);
  const stem = uniqueSlug(base, fileSlugs);
  const publicName = `${stem}${ext}`;
  const dest = path.join(publicDir, "pliki", publicName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  fileMap.set(filename, `/pliki/${publicName}`);
}

const newsSlugs = new Set();
const news = cells
  .map((cell) => {
    const $ = cheerio.load(`<div id="root">${cell.html}</div>`);
    const rendered = blocksFrom($("#root"), $, fileMap).join("\n");
    const tidy = cheerio.load(`<div id="root">${rendered}</div>`);
    tidy("#root p").each((_, paragraph) => {
      if (!tidy(paragraph).text().replace(/\s/g, "") && tidy(paragraph).find("img, a").length === 0) {
        tidy(paragraph).remove();
      }
    });
    const html = tidy("#root").html() || "";
    if (!html.replace(/<[^>]+>/g, "").trim()) return null;
    const title = cell.title.replace(/\s+/g, " ").trim();
    const slug = uniqueSlug(limitSlug(slugify(title)) || (cell.date ? cell.date.iso : "aktualnosc"), newsSlugs);
    const inlineImage = cheerio.load(html)("img").first();
    const image = cell.image || (inlineImage.length
      ? {
          src: inlineImage.attr("src"),
          alt: inlineImage.attr("alt") || title,
          width: Number(inlineImage.attr("width")) || null,
          height: Number(inlineImage.attr("height")) || null,
        }
      : null);
    return {
      slug,
      title,
      date: cell.date?.iso || null,
      dateLabel: cell.date?.label || null,
      excerpt: excerptFrom(html),
      html,
      image,
      order: cell.order,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.order - b.order)
  .map(({ order, ...item }) => item);

const site = {
  name: "Koło Łowieckie „Przepiórka”",
  shortName: "KŁ Przepiórka",
  place: "w Księżynie",
  greeting: "Darz Bór!",
  addressLines: ["Księżyno kolonia 11", "16-001 Kleosin"],
  regon: "050410064",
  nip: "542-196-07-34",
  logo: logo?.src || "/media/style/logo_przepiorka_500x500.png",
  homeImages,
  marks,
  huntBook: {
    title: "EPI24 — Elektroniczna ewidencja polowań",
    url: "https://www.epi24.pl/przepiorka03/",
    android: "https://play.google.com/store/apps/details?id=com.Epi24",
    ios: "https://apps.apple.com/us/app/epi24/id133890444",
    image: epiImage,
  },
};

fs.writeFileSync(path.join(dataDir, "site.json"), JSON.stringify(site, null, 2));
fs.writeFileSync(path.join(dataDir, "albums.json"), JSON.stringify(albums, null, 2));
fs.writeFileSync(path.join(dataDir, "news.json"), JSON.stringify(news, null, 2));

const routes = new Map([
  ["index.html", "/"],
  ["aktualnosci.php", "/aktualnosci/"],
  ["aktualno-ci.html", "/aktualnosci/"],
  ["zarz-d.html", "/zarzad/"],
  ["ksi--ka-polowa-.html", "/ksiazka-polowan/"],
  ["ksi--ka-polowa--.html", "/ksiazka-polowan/"],
  ["historia.html", "/"],
  ["kontakt.html", "/zarzad/"],
  ["imsitemap.html", "/"],
  ["imsearch.php", "/"],
]);
for (const album of albums) routes.set(album.source, `/galeria/${album.slug}/`);

const titled = new Map(albums.map((album) => [album.title.toLowerCase(), `/galeria/${album.slug}/`]));
for (const entry of fs.readdirSync(oldDir)) {
  if (!/\.(html|php)$/i.test(entry) || routes.has(entry)) continue;
  if (entry.startsWith("res/") || entry.includes("imemail")) continue;
  const htmlPath = path.join(oldDir, entry);
  if (!fs.statSync(htmlPath).isFile()) continue;
  const $ = cheerio.load(fs.readFileSync(htmlPath, "utf8"));
  const title = $("#imPgTitle").first().text().replace(/\s+/g, " ").trim().toLowerCase();
  routes.set(entry, titled.get(title) || "/");
}

for (const [filename, target] of routes) {
  if (filename === "index.html") continue;
  writeRedirect(filename, target);
}

fs.writeFileSync(
  path.join(publicDir, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap-index.xml\n`,
);

console.log(`albums ${albums.length}, news ${news.length}, files ${fileMap.size}, redirects ${routes.size - 1}`);
for (const album of albums) console.log(`  /galeria/${album.slug}/  (${album.photos.length})  ${album.title}`);
for (const item of news) console.log(`  /aktualnosci/${item.slug}/  ${item.date || "—"}  ${item.title}`);
