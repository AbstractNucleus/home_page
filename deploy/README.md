# deploy/

What bserver needs to run home_page. `compose.yml` here gets copied to
`/home/abstract/deploy/home_page/` and lives next to a `.env`.

The server holds no source and no build cache — it pulls the image that
`.github/workflows/publish-image.yml` publishes to `ghcr.io`.

## Why the file sits here and not at the repo root

The root already has a `compose.yml`, the one that builds. Compose picks
`compose.yml` over `docker-compose.yml` when both are present, so a pull-only
file added to the root would either overwrite the build file or, named
`docker-compose.yml`, be silently ignored by every bare `docker compose` run in
the root. Either way you would not find out until a deploy did the wrong thing.

`deploy/` holds exactly one compose file, so there is no precedence question in
either directory. The same holds on the server: `/home/abstract/deploy/home_page/`
gets one `compose.yml` and nothing else.

## Two files, one service

`deploy/compose.yml` pulls; the root `compose.yml` builds and is what you use
locally. They describe the same service two ways — change the port or add a
service in one and you must mirror it in the other. They live in the same repo
so the diff shows up in the same review.

## One-time setup

The order matters. A package's visibility cannot be set before the package
exists, and the package does not exist until the workflow has run once.

**1. Merge and push to `main`.** `publish-image.yml` runs and creates
`ghcr.io/abstractnucleus/home_page`.

**2. Wait for the run to go green.** `gh run watch`

**3. Check the package is publicly pullable.** The repo is public, so the
package should come out public too — check rather than assume, because a
private package is the one failure that stops the cutover dead:

```sh
TOK=$(curl -s "https://ghcr.io/token?scope=repository:abstractnucleus/home_page:pull&service=ghcr.io" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOK" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  https://ghcr.io/v2/abstractnucleus/home_page/manifests/latest
```

Three things about that snippet, all of them measured rather than assumed:

- **The `Accept` header is not optional.** buildx publishes an OCI image index,
  and without a header advertising that type the registry answers `404` for a
  tag that is live and public. Verified against `mcontrol`, which is public:
  `200` with the header, `404` without it.
- **`.get('token','')`, not `["token"]`.** For a package that does not exist,
  or is private, the token endpoint returns `{"errors":[{"code":"DENIED",...}]}`
  with no `token` key at all. The subscript form dies with a `KeyError`
  traceback and tells you nothing; the `.get` form yields an empty bearer and
  lets the next request answer `403` cleanly.
- **Run this only after step 2.** Before the first publish it answers `403`,
  which is the same answer a private package gives. Ambiguous, so do not run
  it early and conclude anything.

`200` means bserver can pull anonymously. If you see `403` after a green run,
the package is private:

<https://github.com/users/AbstractNucleus/packages/container/home_page/settings>
→ Danger Zone → Change visibility → Public.

bserver does already hold a `ghcr.io` entry in its snap-docker config
(`/home/abstract/snap/docker/current/.docker/config.json` — not
`~/.docker/config.json`, which does not exist on that host), so a private
package would very likely pull anyway. Do not lean on that. It is a classic
PAT put there for the private `finance_tracker` package; when it expires,
anything relying on it fails at `pull` with `unauthorized` and nothing else
explains why. A public package needs no credential and cannot expire.

**4. Stage the deploy directory.** See the cutover sequence below.

## The .env

This project has **no `.env` today** — neither in the repo nor on bserver, and
`docker inspect` shows the live container carrying only the stock nginx image
variables. So there is nothing to copy across; the cutover has to create the
file, and both keys below are configuration rather than secrets.

| Key | Value on bserver | Notes |
|---|---|---|
| `TAG` | `latest` | or `sha-<short commit>` to pin a build for rollback |
| `HOST_BIND_IP` | `0.0.0.0` | the interface Docker publishes 6789 on; nginx reaches it at `100.124.22.82:6789` |

`HOST_BIND_IP` is required, not defaulted — `${HOST_BIND_IP:?...}`. `0.0.0.0` is
correct for this service, since the site is public through Cloudflare, but a
missing key must fail the deploy rather than silently pick a binding for you.
Verified: with the key absent, `docker compose config` exits `1` with
`required variable HOST_BIND_IP is missing a value`.

If a real secret ever lands here, copy the live file with `cp -p` instead of
retyping it, and add `env_file: .env` to the service. Today that key is
deliberately absent — see the comment at the bottom of `compose.yml`.

## Deploy

```sh
cd /home/abstract/deploy/home_page
docker compose pull
docker compose up -d --wait
```

**`--wait` does not verify this service.** The stack defines no healthcheck, and
`--wait` reports "Healthy" for containers that define none. It proves the
process started, nothing more. Always follow it with a real request:

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://100.124.22.82:6789/
```

## Rollback

Every build is tagged `sha-<short commit>`. Set `TAG` in the server's `.env` to
an earlier one and run the same two commands. No rebuild, no checkout:

```sh
cd /home/abstract/deploy/home_page
sed -i 's/^TAG=.*/TAG=sha-1234567/' .env
docker compose pull
docker compose up -d --wait
curl -s -o /dev/null -w '%{http_code}\n' http://100.124.22.82:6789/
```

To find the tag, read the workflow run — the summary prints every tag it
pushed:

```sh
gh run list --workflow publish-image.yml
gh run view <run-id>
```

`docker image ls` on bserver is not a reliable source: only tags that have
actually been pulled to that host appear, which on day one is just `latest`.

## The old checkout

`/home/abstract/repos/home_page` still exists and its `compose.yml` claims the
same compose project name — **`home_page`**, read off the live container's
`com.docker.compose.project` label, not guessed from the directory. Running the
old command there:

```sh
cd /home/abstract/repos/home_page && git pull && docker compose -p home_page up -d --build
```

will rebuild from source and replace the pulled image, in place, with no error.
It undoes the migration while looking perfectly healthy: same container name,
same port, same 200 from nginx. The only tell is `docker inspect -f
'{{.Config.Image}}' home_page-web-1` reading `home_page-web` instead of
`ghcr.io/abstractnucleus/home_page:latest`.

`HOSTS.md` and the `/deploy` skill must be updated to point at
`/home/abstract/deploy/home_page` before that old path is retired.

The one time the old checkout is the right answer is a full abort — see the end
of the cutover sequence.

---

# Cutover sequence

Read-only up to step 3. Step 4 is the only one that changes anything running.

## 0. Baseline — capture what "working" looks like now

```sh
ssh bserver "docker inspect -f 'image={{.Config.Image}} project={{index .Config.Labels \"com.docker.compose.project\"}} ports={{json .HostConfig.PortBindings}} mounts={{json .Mounts}}' home_page-web-1"
curl -s -o /dev/null -w 'direct  %{http_code}\n' http://100.124.22.82:6789/
curl -s -o /dev/null -w 'apex    %{http_code}\n' https://noelkleen.com/
curl -s -o /dev/null -w 'www     %{http_code}\n' https://www.noelkleen.com/
curl -s http://100.124.22.82:6789/ | grep -o 'styles.css?v=[a-f0-9]*'
```

Note the CSS hash. It changes only when `css/styles.css` changes, so if the
same hash comes back after the cutover, the new image carries the same
stylesheet — a cheap end-to-end check that the build stamped it correctly.

## 1. Publish the image

```sh
git switch -c migrate-to-registry-pull
git add .github/workflows/publish-image.yml deploy/compose.yml deploy/README.md .dockerignore
git commit -m "Publish the site image to ghcr and add a pull-only deploy stack"
git push -u origin migrate-to-registry-pull
# open the PR, merge it, then:
gh run watch
```

## 2. Confirm anonymous pull

Run the check from the "One-time setup" section above. Do not continue until it
prints `200`.

## 3. Stage the deploy directory — nothing running changes yet

```sh
ssh bserver "mkdir -p /home/abstract/deploy/home_page"
scp deploy/compose.yml bserver:/home/abstract/deploy/home_page/compose.yml
ssh bserver "printf 'TAG=latest\nHOST_BIND_IP=0.0.0.0\n' > /home/abstract/deploy/home_page/.env"
```

Neither key is a secret and there is no live `.env` to copy, so writing them
here is safe. Confirm the file renders before going near the running container:

```sh
ssh bserver "cd /home/abstract/deploy/home_page && docker compose config"
```

Expect `name: home_page`, `image: ghcr.io/abstractnucleus/home_page:latest`,
`host_ip: 0.0.0.0`, `published: "6789"`, `target: 80`, `restart: unless-stopped`,
`networks.default.name: home_page_default`, and no `volumes:` anywhere.

Pull the image while the old container is still serving. A pull is not a
deploy — it only fills the local image cache, so a bad tag or a private package
fails here, at your prompt, with the site still up:

```sh
ssh bserver "cd /home/abstract/deploy/home_page && docker compose pull"
```

## 4. Cut over

This replaces `home_page-web-1` in place, because the pinned project name and
service key match the live container. Expect a few seconds of 502 behind nginx
while the container swaps.

```sh
ssh bserver "cd /home/abstract/deploy/home_page && docker compose up -d --wait"
```

## 5. Verify — `--wait` is not verification

```sh
# the container is the pulled image, not a local build
ssh bserver "docker inspect -f 'image={{.Config.Image}} project={{index .Config.Labels \"com.docker.compose.project\"}} restart={{.HostConfig.RestartPolicy.Name}} ports={{json .HostConfig.PortBindings}} mounts={{json .Mounts}}' home_page-web-1"
# expect image=ghcr.io/abstractnucleus/home_page:latest, project=home_page,
# restart=unless-stopped, ports 0.0.0.0:6789, mounts []

# direct to the container
curl -s -o /dev/null -w 'direct        %{http_code}\n' http://100.124.22.82:6789/
curl -s -o /dev/null -w 'direct /proj  %{http_code}\n' http://100.124.22.82:6789/projects/

# through nginx, both hostnames
curl -s -o /dev/null -w 'apex          %{http_code}\n' https://noelkleen.com/
curl -s -o /dev/null -w 'apex /proj    %{http_code}\n' https://noelkleen.com/projects/
curl -s -o /dev/null -w 'www           %{http_code}\n' https://www.noelkleen.com/
curl -s -o /dev/null -w 'www /proj     %{http_code}\n' https://www.noelkleen.com/projects/

# every asset class, so a truncated build context cannot hide
for p in /css/styles.css /js/backdrop.js /fonts/InterTight-latin.woff2 \
         /images/favicon.svg /images/auto_clicker.jpg \
         /projects/projects.json /projects/cards.js; do
  printf '%s  ' "$(curl -s -o /dev/null -w '%{http_code}' "https://noelkleen.com$p")"; echo "$p"
done

# the CSS hash stamp still matches step 0
curl -s https://noelkleen.com/ | grep -o 'styles.css?v=[a-f0-9]*'
```

Everything above must read `200`. A `404` on an asset means the build context
lost a file — check `.dockerignore` before anything else.

## 6. Rollback

**Bad image, keep the new pipeline.** Pin an earlier tag:

```sh
ssh bserver "cd /home/abstract/deploy/home_page && sed -i 's/^TAG=.*/TAG=sha-1234567/' .env && docker compose pull && docker compose up -d --wait"
curl -s -o /dev/null -w '%{http_code}\n' https://noelkleen.com/
```

**Abort the migration entirely.** Take the pull-only stack down first —
otherwise the two fight over the same project name and port:

```sh
ssh bserver "cd /home/abstract/deploy/home_page && docker compose down"
ssh bserver "cd /home/abstract/repos/home_page && docker compose -p home_page up -d --build"
curl -s -o /dev/null -w '%{http_code}\n' https://noelkleen.com/
```

This is the one time the old checkout is the right answer. It is at
`origin/main` and clean, so it rebuilds the site exactly as it was.
