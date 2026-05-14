# noelkleen.com

Source for my personal homepage at [noelkleen.com](https://noelkleen.com) — a colophon page that points to the other small things I run.

## Design

A single page in two columns: identity on the left (name, contact links, a blinking caret), and a directory of subdomains on the right grouped into **elsewhere**, **collaborations**, and **private**.

- Editorial layout, no JavaScript
- Warm dark palette, Roboto Mono throughout
- Caret animation respects `prefers-reduced-motion` for vestibular safety but keeps blinking as a UI affordance

## Stack

- Static HTML + Tailwind CSS v4
- Multi-stage Docker build: Node Alpine compiles + minifies the stylesheet, nginx Alpine serves it
- Build-time SHA hash on `styles.css` for cache busting (no manual version bumps)
- ~20 MB final image

## Run it

```sh
docker compose up --build
```

Then open <http://localhost:6789>.

In production it sits behind a reverse proxy that handles TLS and routing for `*.noelkleen.com`.

## Layout

```
.
├── index.html        # the page
├── src/input.css     # Tailwind entry + custom styles
├── Dockerfile        # build → serve
└── compose.yml       # local dev / deployment
```

The compiled `css/styles.css` is generated inside the build stage and is not committed.
