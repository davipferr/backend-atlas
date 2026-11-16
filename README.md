# Backend Atlas

A map of backend engineering concepts: short explanations, real-world situations and when each one matters.
Built from my Fundamentals of Backend Engineering course notes as a quick-recall reference for a working developer, not a tutorial.

**Live site:** `https://<your-github-user>.github.io/backend-atlas/`

## Stack

- [VitePress](https://vitepress.dev): static site generator for Markdown docs
- Local full-text search (Ctrl + K), dark mode and mobile layout out of the box
- Deployed to GitHub Pages by GitHub Actions on every push to `main`

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173/backend-atlas/
npm run build     # output in docs/.vitepress/dist
npm run preview   # serve the production build
```

## Deploy (first time)

1. Create a GitHub repo named **`backend-atlas`** and push this project to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow runs on every push. The site shows up at `https://<user>.github.io/backend-atlas/`.

If you rename the repo, update `base` in `docs/.vitepress/config.mts` to match.

## Project structure

```text
docs/
├── .vitepress/
│   ├── config.mts          ← site config (title, base path, nav, search)
│   ├── sections.ts         ← sidebar structure: the single source of truth for pages
│   ├── pareto.ts           ← the 80/20 reading path
│   └── theme/              ← brand colors + Vue components (home map, concept index)
├── features.data.ts        ← build-time loader that extracts every concept from the pages
├── index.md                ← home page
├── concepts.md             ← auto-generated Concept Index
├── pareto.md               ← 80/20 Path
└── <section>/<page>.md     ← content
```

## Adding content

Each page is a Markdown file where **every `##` heading is one concept**, followed by a one-line summary blockquote:

````md
## Concept Name

> One sentence: what it is.

Explanation, diagram or code…

::: tip Real world
- A real situation where this concept shows up
:::
````

- The Concept Index, the 80/20 Path and the home page counters update automatically from the `##` headings and `>` summaries.
- Add `<Badge type="tip" text="extra" />` to a heading for concepts beyond the original course.
- New page? Create the `.md` file and add it to `docs/.vitepress/sections.ts`.
- Always put HTML tags and generics in backticks (`` `<div>` ``). Outside code, they are parsed as real HTML.
- Never write `{{` in prose: VitePress treats it as a Vue interpolation (code blocks are safe).
