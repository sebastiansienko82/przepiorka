# Koło Łowieckie „Przepiórka”

Static website for the hunting club in Księżyno. The previous WebSite X5 export is archived in `old/`.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build is written to `docs/` so GitHub Pages can publish this branch from the `/docs` folder. Pages are directories with `index.html`, so `/zarzad/` and `/galeria/polowanie-wigilijne-2025/` work on a normal static host.

`npm run extract` rebuilds `src/data` and copies photos and documents out of `old/`. Run it again only after the archive changes.

Addresses use full words with Polish letters written out (`ł` as `l`, `ś` as `s`). Old broken addresses, such as `zarz-d.html`, redirect to the new ones.
