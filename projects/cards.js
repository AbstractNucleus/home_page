// Renders the project cards from projects.json into #cards. Fetch is
// relative to the page (/projects/), so it resolves to /projects/projects.json.
async function load() {
  const res = await fetch("projects.json");
  const data = await res.json();

  const grid = document.getElementById("cards");
  grid.replaceChildren(...data.projects.map(renderCard));
}

function renderCard(p) {
  const el = document.createElement(p.url ? "a" : "div");
  el.className = "card";
  if (p.url) {
    el.href = p.url;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  }

  const img = document.createElement("div");
  img.className = "card-image";
  if (p.image) img.style.backgroundImage = `url("${p.image}")`;
  el.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = p.title;
  body.appendChild(title);

  if (p.description) {
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = p.description;
    body.appendChild(desc);
  }

  if (p.url) {
    const link = document.createElement("span");
    link.className = "card-link";
    link.textContent = "View →";
    body.appendChild(link);
  }

  el.appendChild(body);
  return el;
}

load();
