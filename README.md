# noelkleen.com

Source for my personal homepage at [noelkleen.com](https://noelkleen.com). One page that links out to the other things I run.

## Stack

Static HTML and one CSS file, served by nginx out of a Docker build. Fonts are self-hosted; the animated backdrop — a drifting contour field and rising embers — is drawn on canvas at runtime. The build stamps a content hash onto `styles.css` so browsers don't hang onto a stale version.

## Running it

```sh
docker compose up --build
```

Then open <http://localhost:6789>. In prod it sits behind a reverse proxy that handles TLS for `*.noelkleen.com`.

## Layout

```
.
├── index.html        the page
├── css/styles.css    tokens + site styles, one file
├── fonts/            Inter Tight woff2, self-hosted
├── images/           the favicon
├── Dockerfile        build then serve
└── compose.yml       local and prod
```
