# noelkleen.com

Source for my personal homepage at [noelkleen.com](https://noelkleen.com). One page that links out to the other things I run.

## Stack

Static HTML, Tailwind v4, served by nginx out of a multi-stage Docker build. The build stamps a content hash onto `styles.css` so browsers don't hang onto a stale version.

## Running it

```sh
docker compose up --build
```

Then open <http://localhost:6789>. In prod it sits behind a reverse proxy that handles TLS for `*.noelkleen.com`.

## Layout

```
.
├── index.html        the page
├── src/input.css     Tailwind entry plus a few custom styles
├── Dockerfile        build then serve
└── compose.yml       local and prod
```
