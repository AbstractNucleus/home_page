# noelkleen.com

Source for my personal homepage at [noelkleen.com](https://noelkleen.com). A home page that links out to the other things I run, plus a `/projects` gallery of things I've built.

## Stack

Static HTML and one CSS file, served by nginx out of a Docker build. Fonts are self-hosted; the animated backdrop — a drifting contour field and rising embers — is drawn on canvas at runtime from `js/backdrop.js`, shared by both pages. The build stamps a content hash onto `styles.css` so browsers don't hang onto a stale version.

## Running it

```sh
docker compose up --build
```

Then open <http://localhost:6789>. In prod it sits behind a reverse proxy that handles TLS for `*.noelkleen.com`.

## Projects

The gallery at `/projects` renders from [`projects/projects.json`](projects/projects.json). Add a project by appending an entry:

```json
{
  "title": "Project name",
  "description": "What it does.",
  "image": "/images/screenshot.jpg",
  "url": "https://example.com"
}
```

`image` and `url` are both optional — skip `image` for a gradient placeholder, `url` for a static card. Put screenshots in `images/`.

## Layout

```
.
├── index.html            the home page
├── projects/             the /projects gallery
│   ├── index.html          card page
│   ├── cards.js            renders the cards from the json
│   └── projects.json       the project list — edit this to add one
├── css/styles.css        tokens + site styles, one file, both pages
├── js/backdrop.js        animated canvas backdrop, shared by both pages
├── fonts/                Inter Tight woff2, self-hosted
├── images/               favicon + project screenshots
├── Dockerfile            build then serve
└── compose.yml           local and prod
```
