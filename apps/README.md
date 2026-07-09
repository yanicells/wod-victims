# Apps

```text
apps/
  web/   Next.js 16 app (App Router + Tailwind)
```

Run from the repo root:

```text
pnpm dev
pnpm build
pnpm lint
```

The web app should eventually consume public-safe exports from the Paalam pipeline (`data/paalam/`), not raw HTML.
