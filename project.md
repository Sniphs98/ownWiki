# Rolle & Ziel
Du bist ein Senior Full-Stack SvelteKit Entwickler. Deine Aufgabe ist es, mit mir ein modernes, Open-Source Wiki-Tool von Grund auf zu entwickeln. Es richtet sich an Nutzer, die technische Dokumentationen und Anleitungen schreiben wollen.

Bitte arbeite sauber, modular und halte dich strikt an die folgenden Anforderungen.

# Kern-Features (MVP)
- **PDF-Export:** Teile der Dokumentation oder das gesamte Wiki sollen als PDF exportierbar sein.
- **Versionierung:** Speichervorgänge sollen versioniert werden, damit man alte Stände einer Anleitung ansehen und wiederherstellen kann.
- **Verlinkungen:** Unterstützung von Obsidian-Style Links (z.B. `[[Seitenname]]`) sowie normalen Links, um auf andere Bereiche verweisen zu können.
- **Inhaltsverzeichnis (ToC):** Soll automatisch aus den Überschriften des Dokuments generiert werden.
- **Seiten-Hierarchie:** Eine einklappbare Sidebar links, um Seiten in Ordnern/Pfaden zu gruppieren (z.B. "Personal/Kündigung" und "Personal/Neuanstellung").
- **Suche:** Eine Volltextsuche über das gesamte Wiki. Die Architektur dafür soll so angelegt sein, dass sie später leicht mit AI (Vector Embeddings) für semantische Themensuche erweitert werden kann.
- **Späteres Feature (Architektur darauf vorbereiten):** Excalidraw für Zeichnungen im Editor.

# Technischer Stack
- **Framework:** SvelteKit (mit Svelte 5 und shadcn-svelte).
- **Datenbank & ORM:** Nutze Drizzle ORM. Es muss so konfiguriert sein, dass man über Umgebungsvariablen einfach zwischen SQLite (für einfache Self-Hosted-Setups) und PostgreSQL (für größere Setups) wechseln kann.
- **Editor:** Milkdown (spezifisch das "Crepe" Preset nutzen, da dort die meisten wichtigen Plugins enthalten sind).
- **Dateiverwaltung (Bilder/Anhänge):** Lege Dateien vorerst direkt als BLOB / Bytea in der Datenbank ab. Das macht das Hosting für den Anfang am einfachsten. Bereite die Architektur aber so vor, dass man später relativ einfach auf einen S3-Klon (z.B. MinIO) wechseln könnte, falls die DB zu groß wird. Baue einen SvelteKit-Endpoint (`/api/files/[id]`), der die Dateien aus der DB ausliefert.
- **Hosting:** Das Projekt muss vollständig in Docker hostbar sein. Erstelle dafür ein `Dockerfile` und eine `docker-compose.yml`.
- **Testing:** Schreibe von Beginn an Tests! Nutze Vitest für Unit-Tests und Playwright für E2E-Tests.

# Authentifizierung & Zugriffsrechte
- **Auth-System:** Nutze "Better Auth" (kompatibel mit Drizzle).
- **Flexible Sichtbarkeit:** Das Wiki MUSS auch ohne Login nutzbar sein. Dies soll über Umgebungsvariablen (z.B. `AUTH_MODE`) gesteuert werden:
  1. `disabled`: Komplett ohne Login nutzbar. Jeder darf lesen und schreiben.
  2. `read-only`: Ohne Login darf jeder lesen. Zum Bearbeiten/Erstellen muss man sich anmelden.
  3. `full`: Ohne Login gibt es gar keinen Zugriff (Private Wiki).
Der Code in der SvelteKit `hooks.server.ts` muss diese Modi sauber verarbeiten.

# Vorgehensweise (WICHTIG!)
Bitte baue nicht das ganze Projekt auf einmal. Gehe Schritt-für-Schritt vor und frage mich nach jedem Schritt, ob alles passt, bevor du zum nächsten übergehst:

- **Schritt 1:** (Setup & Meta-Skills): Nutze deine MCP Server und AI-Skills, um die aktuellsten Best-Practices und Dokumentationen für Svelte, TailwindCSS und shadcn-svelte abzurufen. Erstelle basierend darauf das initiale SvelteKit Setup mit shadcn-svelte. Richte danach Drizzle (mit flexibler SQLite/Postgres Konfiguration) und die Docker-Dateien (Dockerfile & docker-compose.yml) ein.
- **Schritt 2:** Datenbankschema für Pages, Versions, Attachments (BLOB), User und Better Auth Setup.
- **Schritt 3:** Implementierung der SvelteKit Hooks für das flexible Auth-System.
- **Schritt 4:** Basic UI-Layout (Sidebar, Navigation) und Integration des Milkdown/Crepe-Editors.
- **Schritt 5:** Datei-Upload/Download-Logik in die DB und Integration in den Editor.
- **Schritt 6:** Logik für Versionierung, Obsidian-Links und den PDF-Export.
- **Schritt 7:** Tests für die Kernfunktionen schreiben.

Lass uns mit Schritt 1 und 2 beginnen. Zeige mir die Dateistruktur, das Drizzle-Schema und die Docker-Konfiguration.

Mache zwischen commites wenn du mit was fertig bist da man dann einfach zurück springen kann. Stichwort atomare commites