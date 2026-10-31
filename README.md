# ownWiki

A self-hosted wiki for technical documentation, how-tos and a team's shared knowledge — with a PDF export that looks exactly like the page in the browser, and a connection to AI assistants such as ChatGPT that can search, read and write the wiki as the person using them.

The user interface is in German. Where this README names a button or menu, it gives the German label as you see it in the app, e.g. **Verschieben** (Move).

![A wiki page with the sidebar, a checklist and a table](docs/screenshots/seite.png)

## Features

- **WYSIWYG editor on top of Markdown** ([Milkdown Crepe](https://milkdown.dev)): headings, lists, checklists, tables, code with syntax highlighting, formulas, images.
- **The first line is the title**: the heading on a page's first line is its title — there's no separate title field. A page without a heading on top keeps its title.
- **PDF export that matches the screen** — single pages, whole areas with their subpages, or the entire wiki.
- **Page break preview**: while you write, a line shows where the PDF starts a new page.
- **Diagrams in the text**: Mermaid, BPMN (bpmn-js) and Excalidraw.
- **Files in the text**: upload them and insert a download link where they belong.
- **Full-text search** across titles, paths and text, with the matches highlighted — and optionally a **semantic search** that finds pages by meaning.
- **Version history**: every save is kept; older versions can be viewed and restored.
- **Wiki links** in Obsidian style, `[[Page name]]` or `[[Page name|label]]`, with suggestions while you type. They keep working when the linked page is renamed or moved, and every page lists the pages linking to it (backlinks).
- **Moving pages** with their subpages, with redirects from the old addresses and a permanent link per page.
- **Tags** on pages, gathered under `/tags`.
- **An inbox** per person for quick notes, to be sorted into pages later.
- **Page hierarchy** by path (`hr/onboarding`), shown as a collapsible sidebar; folders open as a list of what's in them, and everyone can **pin** pages and folders to the top.
- **Table of contents** of the open page, next to the text.
- **Customizable toolbar**, **light and dark mode**, a save bar that stays in reach on long pages (and **Ctrl+S**).
- **Three access modes** — from an open team wiki to a private one — plus **permissions per area** for groups and individual people.
- **Log in with Microsoft** (Entra ID) or with email and password.
- **AI assistants** (ChatGPT, Claude …) connect over the Model Context Protocol, each person with their own login.
- **SQLite or PostgreSQL**, runs entirely in Docker.

### Table of contents

To the right of the text, **Auf dieser Seite** (On this page) lists the headings of the open page, indented by level, and stays visible while you scroll. A click jumps to the heading; the section you're reading is highlighted. While editing, it follows every change right away. It appears once there's enough room beside the text column (a content area of at least 1360 px, e.g. Full HD with the sidebar open).

### Writing

Format with the toolbar, with Markdown shortcuts (`## `, `- `, `**bold**` …) or with the **"/" menu**: type `/` in an empty line.

![The editor with its toolbar and the "/" menu open](docs/screenshots/editor.png)

Which tools the toolbar shows, and in which order, everyone sets for themselves under **Einstellungen** (Settings, the gear at the top right). With an account it's stored in the account, otherwise in the browser.

![Toolbar settings](docs/screenshots/einstellungen.png)

While editing, the row with **Löschen**, **Abbrechen** and **Speichern** (Delete, Cancel, Save) stays at the bottom of the window, with the text fading out behind it; **Ctrl+S** (⌘S on a Mac) saves too.

### PDF export

**PDF** on a page opens the export settings: with subpages (the whole area), with a table of contents, and with a title page of your own. **Ganzes Wiki als PDF** (Whole wiki as PDF) on the start page exports everything, cover included. A page's buttons (PDF, page breaks, history, edit) sit to the left of the text, or above it in narrow windows.

You design the **title page** right in the export dialog, on an A4 sheet, with the regular editor: heading, text, a logo or other images (drag a corner to resize) — just like on a wiki page. The sheet shows margins and proportions as in the PDF; the content can be aligned horizontally (left/center) and vertically (top/center/bottom), e.g. for a logo in the middle of the page. **Ganze Seite** shows the whole sheet, **100 %** its actual size. If the content doesn't fit on one page, the dialog says so. The title page is saved with the page on export and is there again next time; in the PDF it replaces the generated cover as page 1. With the title page switched off, the sheet stays visible, greyed out.

The PDF isn't rebuilt from the content but produced from the real page: the same text width (A4 with margins), the same embedded fonts, the same editor. Lines therefore break at exactly the same places. Tables and long code blocks are split across pages row by row, and a table's header repeats on every page.

Every PDF has bookmarks for the PDF viewer's sidebar: each wiki page, with its sections below it. With **Inhaltsverzeichnis** (Table of contents) checked — in the export dialog or on the start page — a printed contents page with page numbers follows the cover or title page: pages and their headings of the first two levels, clickable in the PDF. Single pages then get a cover too, so the contents always start on page 2. The browser remembers the setting.

<p align="center">
  <img src="docs/screenshots/pdf-seite.png" alt="First page of an exported PDF" width="420">
</p>

So you can see while writing where a page ends, a dashed line marks every page break — also in the middle of a paragraph, a table or a code block. **Seitenumbrüche** (Page breaks) turns it on and off.

![A dashed "Seite 2" line between two sections](docs/screenshots/seitenumbrueche.png)

### Diagrams

Diagrams are inserted with the "/" menu (group **Diagramme**) or the toolbar. They live as code blocks in the page's Markdown (` ```mermaid `, ` ```bpmn `, ` ```excalidraw `) — so they're versioned with the page and end up in the PDF. What you see is the rendered diagram:

![A BPMN process and a Mermaid sequence diagram on one page](docs/screenshots/diagramme.png)

**Bearbeiten** (Edit) on a diagram opens the matching editor in a large dialog: Mermaid code with a live preview, the bpmn-js modeler or the Excalidraw canvas.

| BPMN                                                           | Excalidraw                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| ![BPMN editor in the dialog](docs/screenshots/bpmn-editor.png) | ![Excalidraw canvas in the dialog](docs/screenshots/excalidraw.png) |

All diagram libraries — Excalidraw's fonts included — are served by the wiki itself; no external services are contacted. They're loaded only when a page needs them.

### Files

**Datei** (File) in the "/" menu or the toolbar uploads one or more files (up to 10 MB each) and inserts a download link at the cursor. Images that should appear in the text go in with **Bild** (Image). Files no longer linked in the text are listed in the edit view — to insert again or to delete for good.

### Search

The search field at the top center searches the titles, paths and text of all pages (not diagram sources). Results are sorted by relevance — matches in the title count more — and the matched words are highlighted in the snippet. Every search word must occur; other forms of a word are found too ("Kündigungen" finds "Kündigung").

![Search results with a highlighted match](docs/screenshots/suche.png)

On SQLite, ownWiki searches with FTS5; on PostgreSQL, with the database's German full-text configuration (with real stemming). The index is updated on every save and built automatically on first start.

**Semantic search (optional):** with an embeddings service, the search also finds pages by meaning — "Datensicherung" (data backup) finds the section "Backup", the question "wie beantrage ich Urlaub?" (how do I request leave?) the page about leave requests. Such results appear among the full-text ones, marked **inhaltlich ähnlich** (similar in content); AI assistants search the same way. For this, every page is cut into sections and the service computes a vector (embedding) for each. New and changed pages are added within seconds, existing ones on first start. If the service can't be reached, ownWiki keeps searching by full text.

Any service with OpenAI's embeddings API works (see `EMBEDDINGS_URL` below), for example:

- **OpenAI:** `EMBEDDINGS_URL=https://api.openai.com/v1`, `EMBEDDINGS_MODEL=text-embedding-3-small` and an API key. A whole company wiki costs cents.
- **Azure OpenAI** (data in the EU): `EMBEDDINGS_URL=https://<resource>.openai.azure.com/openai/v1`, with your deployment's name as the model.
- **Locally with [Ollama](https://ollama.com)**, without text leaving the server and without a GPU — easiest with the bundled container, see [Quick start](#quick-start-with-docker). Without Docker: `EMBEDDINGS_URL=http://localhost:11434/v1`, `EMBEDDINGS_MODEL=bge-m3` (after `ollama pull bge-m3`).

You can switch between local and cloud at any time: after a model change, ownWiki embeds all pages again in the background and uses full-text search until then.

The service sees the text of all pages, including areas only a few people may read — otherwise those people couldn't find them. Who sees what in the results is still governed by the permissions. The vectors are kept in the wiki's own database (table `page_search_chunk`) and compared in memory; no database extension such as pgvector is needed.

### Links and moving pages

- **Suggestions:** type `[[` in the editor — or pick **Seite verlinken** (Link a page) in the "/" menu — and a list suggests matching pages (title and path). Choose with the arrow keys; Enter or Tab inserts the link, Escape closes the list. For a name no page has yet, there's "„…" verlinken (neue Seite)" to link a page that doesn't exist yet. If two pages share a title, the path is inserted (`[[hr/leave|Leave]]`) so it's clear which one is meant.
- **Links keep working:** when a page is saved, the wiki records which page each of its links means. If that page is renamed or moved, the link still leads there and shows its current title; if another page later gets the old name, it doesn't take over existing links. The text keeps what was written — but opened in the editor, it already reads the current name.
- **Moving:** **Verschieben** (Move) on a page or folder picks the new folder and name. Beforehand, the dialog shows the new address, how many subpages go along, how many pages link here — and who would gain or lose read access at the new place, because that area's rules apply there. Old addresses redirect, and the history notes the move.
- **Permanent link:** **Link kopieren** (Copy link) copies an address of the form `/p/…` that always leads to the page wherever it's moved — handy for emails and tickets.

### Backlinks, tags, inbox and pins

- **Backlinks:** below every page, **Verlinkt von** (Linked from) lists the pages that link to it with a `[[wiki link]]` or a `/w/…` link — as far as you may read them. Links written before the page existed count as soon as it does.
- **Tags:** set them below the editor, separated by commas ("hr, leave"). They appear below the page title; the tag icon at the top right leads to all tags and their pages. Tags aren't part of the version history.
- **Inbox:** the inbox icon at the top right (with the number of open notes) takes a quick note that has no place yet — only you see your inbox. **Einsortieren** (Sort in) moves a note into a page: appended if the page exists, otherwise as a new page.
- **Pins and folders:** hovering a page or folder in the sidebar shows a pin; pinned items move to the top of their level, for you only. A folder — a path with pages below it but none of its own — opens as a list of what's in it.

### Version history

Every save creates a new version. In the history, every version can be viewed and restored.

![Version history with two versions](docs/screenshots/verlauf.png)

### Dark mode

The icon at the top right switches between light, dark and the system setting. Diagrams stay on a white background, so they look just like in the (always light) PDF.

![A diagram page in dark mode](docs/screenshots/dunkelmodus.png)

### Log in with Microsoft

With your company's Microsoft account (Entra ID), people log in with **Mit Microsoft anmelden** (Sign in with Microsoft) — also when connecting ChatGPT. Only accounts of your tenant get in, not any Microsoft account.

- Whoever logs in with Microsoft for the first time gets an account — even if registration is otherwise closed (`ALLOW_SIGNUP` only governs email and password).
- If an account with the same email address exists, it's taken over: the same person, the same permissions, no second account.
- As before, the very first account is an admin.
- With `PASSWORD_LOGIN=false`, logging in with Microsoft is the only way in.

**Setting it up (once, in the [Microsoft Entra admin center](https://entra.microsoft.com)):**

1. _Applications → App registrations → New registration_: a name such as "ownWiki", supported account types _Accounts in this organizational directory only_ (single tenant), a redirect URI of type _Web_: `https://your-wiki.example.org/api/auth/callback/microsoft` (the address in `ORIGIN`, plus `BASE_PATH` if the wiki runs under a path: `https://example.org/wiki/api/auth/callback/microsoft`).
2. On the overview page, set the _Application (client) ID_ as `MICROSOFT_CLIENT_ID` and the _Directory (tenant) ID_ as `MICROSOFT_TENANT_ID`.
3. _Certificates & secrets → New client secret_: set its **value** as `MICROSOFT_CLIENT_SECRET`. It expires (after at most 24 months): create a new one in time — the app can have two at once, so the switch needs no downtime.
4. Optional: _API permissions → Grant admin consent_, so nobody has to consent individually on their first login (only `openid`, `profile`, `email`, `offline_access` and `User.Read` are needed).
5. Optional, if not everyone in the tenant should get in: under _Enterprise applications → ownWiki → Properties_, turn on _Assignment required_ and choose who may under _Users and groups_.

### Permissions per area

Admins create groups such as "HR" under **Verwaltung** (Administration, the shield icon at the top right) and grant rights: for an area — a page path with everything below it, or the whole wiki — to everyone, a group or a single person, each either _kein Zugriff_ (no access), _lesen_ (read) or _bearbeiten_ (edit).

- Without a rule, everyone may read and edit everything.
- A rule on `hr` also applies to `hr/onboarding`; a rule on a sub-area takes precedence for the same group or person.
- A person's own rule takes precedence over their groups' (of several groups, the most generous counts), a group's over the one for everyone.
- Admins may always do everything. A wiki's first account is an admin; more are appointed under Verwaltung.

What someone may not read doesn't exist for them: the page is missing from the sidebar, the search, PDF exports, links and backlinks, and its files can't be fetched. The same goes for AI assistants — they may do exactly what the person who connected them may do. `AUTH_MODE` still limits what's possible without logging in.

### AI assistants (MCP)

ownWiki can serve as a "second brain" for AI assistants such as ChatGPT or Claude, over the [Model Context Protocol](https://modelcontextprotocol.io). The assistant can then search the wiki, read pages, list areas and tags, look up backlinks — and create, change, tag, move or append to pages. It also takes notes in the person's inbox on request ("notier dir das" — take a note of this) and sorts notes into the wiki together with them. Every change is a new version; the history shows who made it through which assistant (e.g. "Erika Muster über ChatGPT"). Assistants can't delete pages.

| Tool                                                                 | What it does                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `search`, `fetch`                                                    | Search (by words, and by meaning if set up) and read a page in full    |
| `list_pages`, `list_tags`, `get_backlinks`                           | Browse areas and tags, find related pages                              |
| `create_page`, `update_page`, `append_to_page`, `move_page`          | Write; `update_page` refuses to overwrite a newer version than it read |
| `add_to_inbox`, `list_inbox`, `file_inbox_note`, `delete_inbox_note` | The person's inbox                                                     |

The address for the assistant is `https://your-wiki.example.org/mcp` (under a path: `https://example.org/wiki/mcp`). It logs in with **OAuth**: everyone connects the assistant once to their own wiki account — log in, then **Erlauben** (Allow) — and from then on the assistant acts as that person. So it's clear who did what, and there's no shared password. Assistants register themselves (dynamic client registration). Under **Einstellungen → KI-Verbindungen** (Settings → AI connections), everyone sees their connected assistants and can disconnect them; access ends at once.

This needs `ORIGIN` to be set — without it, there's no MCP endpoint.

- **ChatGPT Business/Enterprise:** an admin turns on developer mode in the workspace settings, creates a connector with the address above and "OAuth" authentication, and publishes it to the workspace. After that, everyone connects themselves on first use.
- **Claude Code and other MCP clients:** add the address as an HTTP MCP server, e.g. `claude mcp add --transport http ownwiki https://your-wiki.example.org/mcp`.

ChatGPT calls the wiki from OpenAI's servers, not from your computer. The wiki doesn't have to be publicly reachable for that: OpenAI's [Secure MCP Tunnel](https://github.com/openai/tunnel-client) opens an outgoing connection from your own network.

## Quick start with Docker

```sh
cp .env.example .env
# In .env, set at least:
#   BETTER_AUTH_SECRET – a random value, e.g. from: openssl rand -base64 32
#   ORIGIN             – the address the wiki is reached at, e.g. http://localhost:3000
docker compose up -d
```

The wiki then runs on port 3000. The database (SQLite) lives in the Docker volume `wikidata`; migrations run automatically on start. For PostgreSQL, set `DATABASE_DIALECT=postgresql` and the matching `DATABASE_URL` in `.env` and start with `docker compose --profile postgresql up -d`.

**Back up the database before updating** to a new version — migrations change it on start.

**Semantic search on your own hardware:** additionally set

```sh
EMBEDDINGS_URL=http://ollama:11434/v1
EMBEDDINGS_MODEL=bge-m3
EMBEDDINGS_MIN_SCORE=0.5
```

in `.env` and start with `docker compose --profile ollama up -d`. This runs [Ollama](https://ollama.com) as a container of its own and downloads the model on first start (bge-m3, about 1.2 GB; it understands German well). No GPU is needed; the model takes about 2 GB of memory. Once it's there, the wiki embeds all pages in the background. Measured on a 12-thread CPU without a GPU: about 30 ms per search and about 0.3 s per section to embed — roughly half an hour for 1,000 pages on first start, then a second or two per saved page. If the hardware isn't enough, set a cloud service such as Azure OpenAI instead (see [Search](#search)) and start without `--profile ollama`.

The image includes Chromium for the PDF export.

Instead of building it yourself, you can use the ready-made image from the GitHub Container Registry: in `compose.yaml`, replace `build: .` with `image: ghcr.io/sniphs98/ownwiki:latest` (or a fixed version such as `:1.4.0`).

## Behind a reverse proxy

ownWiki runs behind any reverse proxy (Traefik, nginx, Caddy …), on a domain of its own (`https://wiki.example.org`) or under a path (`https://example.org/wiki`). For a path, set `BASE_PATH` — when the container starts, not when the image is built, so the published image works for both.

- `ORIGIN` is the public address **without** the path: `https://example.org`, not `https://example.org/wiki`.
- `ADDRESS_HEADER=X-Forwarded-For` with `XFF_DEPTH=1` (one proxy in front) makes the login rate limit see the visitors' real addresses instead of the proxy's.
- The proxy must pass requests on unchanged — in particular without stripping the path: the wiki expects `/wiki/…`.
- AI assistants look for the OAuth documents at the domain's root (`/.well-known/oauth-protected-resource/wiki/mcp`, `/.well-known/oauth-authorization-server/wiki/api/auth`), as the standard says. Under a path, the proxy passes those on to the wiki too, with the path in front. Without the AI connection, that rule isn't needed.

**Traefik**, with the wiki under `/wiki` — `compose.yaml` (`websecure` and `letsencrypt` are your Traefik's entry point and certificate resolver):

```yaml
services:
  app:
    image: ghcr.io/sniphs98/ownwiki:latest
    restart: always
    env_file: .env
    environment:
      ORIGIN: https://example.org
      BASE_PATH: /wiki
      ADDRESS_HEADER: X-Forwarded-For
      XFF_DEPTH: '1'
    volumes:
      - wikidata:/app/data
    labels:
      - traefik.enable=true
      - traefik.http.services.ownwiki.loadbalancer.server.port=3000
      # The wiki itself.
      - traefik.http.routers.ownwiki.rule=Host(`example.org`) && (Path(`/wiki`) || PathPrefix(`/wiki/`))
      - traefik.http.routers.ownwiki.entrypoints=websecure
      - traefik.http.routers.ownwiki.tls.certresolver=letsencrypt
      - traefik.http.routers.ownwiki.service=ownwiki
      # Where AI assistants look for how to log in: at the root, passed on under /wiki.
      - traefik.http.routers.ownwiki-oauth.rule=Host(`example.org`) && (PathPrefix(`/.well-known/oauth-protected-resource/wiki`) || PathPrefix(`/.well-known/oauth-authorization-server/wiki`) || PathPrefix(`/.well-known/openid-configuration/wiki`))
      - traefik.http.routers.ownwiki-oauth.entrypoints=websecure
      - traefik.http.routers.ownwiki-oauth.tls.certresolver=letsencrypt
      - traefik.http.routers.ownwiki-oauth.middlewares=ownwiki-oauth
      - traefik.http.routers.ownwiki-oauth.service=ownwiki
      - traefik.http.middlewares.ownwiki-oauth.addprefix.prefix=/wiki

volumes:
  wikidata:
```

On a domain of its own, a single router with `Host(`wiki.example.org`)` is enough, and `BASE_PATH` stays unset. Traefik has no upload limit by default; with another proxy, allow request bodies of at least 11 MB (e.g. nginx `client_max_body_size 11m;`) and a read timeout that a large PDF export fits into (a minute is plenty).

## Configuration

| Variable                  | Meaning                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_DIALECT`        | `sqlite` (default) or `postgresql`                                                                                                                                                    |
| `DATABASE_URL`            | SQLite: path to the file, e.g. `./data/wiki.db` · PostgreSQL: connection URL                                                                                                          |
| `ORIGIN`                  | The wiki's public address. Used for logging in, the AI connection and absolute links in PDFs.                                                                                         |
| `BETTER_AUTH_SECRET`      | Secret for sessions (at least 32 characters)                                                                                                                                          |
| `AUTH_MODE`               | Who may do what, see below. Default: `read-only`                                                                                                                                      |
| `ALLOW_SIGNUP`            | Who may create an account with email and password, see below. Default: only the first account                                                                                         |
| `MICROSOFT_CLIENT_ID`     | Log in with Microsoft: the app registration's application ID (see above). All three `MICROSOFT_*` together turn it on                                                                 |
| `MICROSOFT_CLIENT_SECRET` | The app registration's client secret                                                                                                                                                  |
| `MICROSOFT_TENANT_ID`     | Your company's directory (tenant) ID — only accounts from it get in                                                                                                                   |
| `PASSWORD_LOGIN`          | `false`: log in with Microsoft only, no passwords. Default: both                                                                                                                      |
| `BASE_PATH`               | The path the wiki is served under behind a reverse proxy, e.g. `/wiki` (see above). Set at start, no new build needed. Default: the root                                              |
| `XFF_DEPTH`               | With `ADDRESS_HEADER=X-Forwarded-For`: how many proxies sit in front of the wiki, usually `1`                                                                                         |
| `PORT`                    | The server's port, default `3000`                                                                                                                                                     |
| `ADDRESS_HEADER`          | Behind a reverse proxy: the header with the client's real IP, e.g. `X-Forwarded-For`                                                                                                  |
| `BODY_SIZE_LIMIT`         | The largest request the server accepts. `11M` in the Docker image, so uploads of up to 10 MB work                                                                                     |
| `EMBEDDINGS_URL`          | An embeddings service with OpenAI's API, for the semantic search (see above). Without it: full-text search only                                                                       |
| `EMBEDDINGS_MODEL`        | The embedding model's name, e.g. `text-embedding-3-small`                                                                                                                             |
| `EMBEDDINGS_API_KEY`      | The service's API key, if it needs one                                                                                                                                                |
| `EMBEDDINGS_DIMENSIONS`   | Optional: ask for shorter vectors, e.g. `512` with `text-embedding-3-*` — saves memory                                                                                                |
| `EMBEDDINGS_MIN_SCORE`    | How similar (0–1) a page must be to count as a match by meaning. Default `0.3` (fits `text-embedding-3-*`); `0.5` for `bge-m3`. Other models: raise it if too much unrelated is found |

**Access modes (`AUTH_MODE`):**

- `disabled` — no login needed: everyone may read and write.
- `read-only` — everyone may read; editing needs a login.
- `full` — no access at all without a login (private wiki).

**Registration (`ALLOW_SIGNUP`):**

- unset (default) — only the first account can register; after that, registration is closed.
- `true` — anyone may register.
- `false` — nobody may register.

With `AUTH_MODE=full`, registration should stay closed — otherwise anyone can let themselves into the private wiki. Logging in with Microsoft is the usual way to let a whole company in.

## Development

Requires Node.js 24.

```sh
npm install
cp .env.example .env                       # set BETTER_AUTH_SECRET and ORIGIN=http://localhost:5173
node --env-file=.env scripts/migrate.js    # create or update the database
npx playwright install chromium            # once, for the PDF export
npm run dev
```

Use the migrations rather than `npm run db:push`: some of them carry hand-written steps (making the oldest account an admin, keeping link bindings when a page is deleted) that `db:push` skips.

| Command                           | Purpose                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Development server at http://localhost:5173                                                                                  |
| `npm run check`                   | Type check (svelte-check)                                                                                                    |
| `npm run lint` / `npm run format` | Prettier and ESLint                                                                                                          |
| `npm run test:unit`               | Unit tests with Vitest                                                                                                       |
| `npm run test:e2e`                | End-to-end tests with Playwright                                                                                             |
| `npm run build`                   | Production build (`npm start` runs it, under `BASE_PATH` if set)                                                             |
| `npm run db:generate`             | Generate a migration from schema changes (run once for SQLite and once for PostgreSQL, with the matching `DATABASE_DIALECT`) |

The end-to-end tests build the app and run it as in the Docker image (`npm start`), with databases of their own under `.data/e2e/`, seeded fresh on every run — the development database stays untouched. Next to the main server they start servers for the other access modes a server under `BASE_PATH=/wiki`, and stand-ins for an embeddings service (`e2e/fake-embeddings.js`) and for Microsoft's login (`e2e/fake-microsoft.js`). Among other things, they check that the web view and the PDF break at the same places, that no blank pages appear and that the page break lines match the real PDF.

On every pull request and every push to `main`, GitHub Actions runs lint, type check, unit and end-to-end tests and the Docker build (`.github/workflows/ci.yml`). There, an end-to-end test that fails once is retried once and reported as flaky.

### Releases

Every merge to `main` is released automatically (`.github/workflows/auto-release.yml`). The pull request's label decides how the version moves on from the last tag:

| Label on the PR | Version                                  |
| --------------- | ---------------------------------------- |
| _none_          | Patch: `1.2.3` → `1.2.4`                 |
| `feature`       | Minor: `1.2.3` → `1.3.0`                 |
| `breaking`      | Major: `1.2.3` → `2.0.0`                 |
| `kein-release`  | No release (e.g. docs, tests or CI only) |

The release first runs the full CI, then builds the Docker image and publishes it as `ghcr.io/sniphs98/ownwiki` with the tags `1.2.0`, `1.2` and `latest`. Finally it creates the version tag and a GitHub release with generated release notes.

Releasing by hand still works with a version tag (`.github/workflows/release.yml`):

```sh
git tag v1.2.0
git push origin v1.2.0
```

Tags with a suffix such as `v1.2.0-rc.1` are published as pre-releases and don't move `latest`.

### Architecture

- **SvelteKit** (Svelte 5) with **shadcn-svelte** and Tailwind CSS
- **Drizzle ORM** for SQLite and PostgreSQL (`src/lib/server/db`, repositories in `src/lib/server/repo`, migrations in `drizzle/`)
- **Better Auth** for accounts, Microsoft login and as the OAuth server for AI assistants (`src/lib/server/auth.ts`); access modes and permissions are enforced via `src/hooks.server.ts` and `src/lib/server/access.ts`
- **Milkdown Crepe** as the editor (`src/lib/components/wiki/markdown-editor.svelte`), with ProseMirror plugins of its own, e.g. for the `[[` suggestions (`src/lib/editor-link-suggest.ts`)
- **PDF export**: the `/print/…` route renders the pages with the real editor, [pagedjs](https://pagedjs.org) splits them into A4 pages, and a Chromium (Playwright) on the server prints the result to PDF (`src/lib/server/pdf`, `src/lib/paginate.ts`). The page break preview runs the same pagination invisibly in the browser (`src/lib/page-breaks.ts`).
- Files are stored as BLOBs in the database and served from `/api/files/[id]`.
- **Links** (`src/lib/wiki-links.ts`, table `page_link`): every link is bound to the page id it meant when saved, so moves and renames don't break it; old paths of moved pages live in `page_redirect`.
- **Search** (`src/lib/server/search`): full text in the database, plus optional semantic search — pages are cut into sections (`semantic/chunks.ts`), embedded in the background, compared in memory and merged with the full-text results by reciprocal rank fusion.
- **MCP server** for AI assistants at `/mcp` (`src/lib/server/mcp`, the official MCP SDK, stateless over Streamable HTTP), protected by OAuth — Better Auth's `mcp()` plugin makes the wiki the OAuth server too (consent page at `/consent`).

## Not done yet

- Storing files in S3-compatible storage (e.g. MinIO) instead of the database
- Moving pages by drag and drop in the sidebar
