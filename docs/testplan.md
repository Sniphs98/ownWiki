# Testplan

Wie ownWiki auf Fehler geprüft wird: welche Bereiche, mit welchen Mitteln, und
was eine Prüfrunde gefunden hat. Die gefundenen Fehler haben jeweils einen Test,
der sie künftig abfängt.

## Testarten

| Art                 | Werkzeug                                              | Wofür                                                                                             |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unit-Tests          | Vitest (`npm run test:unit`)                          | Reine Logik: Wiki-Links, Suchtext, Slugs, Weiterleitungen, Header, Limits                         |
| End-to-End          | Playwright (`npm run test:e2e`)                       | Der echte Produktionsserver (adapter-node) mit frischer SQLite-Datenbank, im Browser und per HTTP |
| Statische Prüfung   | `npm run check`, `npm run lint`                       | Typen, Svelte-Warnungen (z. B. `state_referenced_locally`), Formatierung                          |
| Explorative Prüfung | Code-Review + Probe-Skripte gegen einzelne Funktionen | Randfälle finden, bevor ein Test dafür geschrieben wird                                           |

Playwright startet drei Server aus demselben Build, je einen pro `AUTH_MODE`
(`disabled` auf 4173, `read-only` auf 4174, `full` auf 4175), jeweils mit eigener
Datenbank. So sind auch die Zugriffsregeln abgedeckt.

## Prüfbereiche

Nach Risiko geordnet — oben, was am meisten Schaden anrichten kann.

1. **Zugriffsschutz** (`hooks.server.ts`, `require-edit-access.ts`, PDF-Token)
   - Ohne Login in `read-only`: Lesen ja; Speichern, Löschen, Wiederherstellen,
     Upload, Datei löschen, Titelseite, Einstellungen → 401.
   - Formular ohne Login aus dem Browser → Weiterleitung zum Login.
   - `full`: ohne Login weder Seiten, Druckansicht, PDF noch Suche.
   - Weiterleitung nach dem Login nur auf Pfade dieses Wikis (`//evil.example`, `/\evil.example`).
   - Das interne PDF-Token verlässt den Server nicht und erlaubt nur Lesen.
2. **Inhalte** (Wiki-Links, Speichern, Versionen, Konflikte)
   - `[[Seite]]`, `[[Seite|Text]]`, `[[Seite#Abschnitt]]`, escapte Formen aus Milkdown, auch in Tabellen.
   - Code (Blöcke und Inline-Code) bleibt unverändert.
   - Gleichzeitiges Bearbeiten → Konfliktmeldung statt Überschreiben.
3. **Dateien**
   - Uploads bis zur angegebenen Grenze (10 MB) gehen auch im Produktionsserver durch.
   - Gefährliche Typen (HTML, SVG) werden als Download mit Sandbox ausgeliefert.
   - Dateinamen mit Umlauten, Leerzeichen, `'()*` korrekt im `Content-Disposition`.
4. **Suche**: Wortformen, Treffer-Markierung, keine Diagrammquellen, kein Markdown-Rest im Snippet.
5. **PDF-Export**: Seitenumbrüche, Titelseite, Inhaltsverzeichnis, Schriften (bestehende Tests).
6. **Navigation**: Seitenbaum zeigt die geöffnete Seite, auch nach Navigation über einen Link.
7. **Editor** (`e2e/editor.e2e.ts`) — die Hauptaufgabe der App, deshalb am breitesten getestet:
   - Schreiben: Sonderzeichen und Markdown-Zeichen kommen gespeichert genau so wieder heraus;
     Speichern direkt nach dem Tippen; Absatz teilen/verbinden; Rückgängig/Wiederholen; Strg+B/I.
   - Markdown-Kürzel: `#`–`###`, `-`, `1.`, `- [ ]`, `>`, `---`, ` ``` `, `**`/`*`/`` ` ``/`~~`,
     `![Bild](…)`, `[Text](…)`, getippte Webadressen.
   - Listen: Tab/Shift+Tab, Enter beendet die Liste, Nummerierung und Checklisten laufen weiter.
   - Navigieren: Pfeiltasten zwischen Absätzen, Pos1/Ende, Strg+Pos1/Ende, in Codeblöcke hinein
     und heraus, Codeblock/Tabelle/Trennlinie am Seitenende verlassen, Tab in Tabellen.
   - „/“-Menü: Filtern, Escape, jeder Eintrag fügt das Richtige ein, Pfeiltasten mit ruhender
     Maus über dem Menü, Auswahl per Maus.
   - Werkzeugleiste: jede Schaltfläche, Absatzformat-Menü.
   - Verlinken: Wiki-Links tippen und folgen, Link auf Überschrift, Link auf fehlende Seite legt
     sie an, Markdown-Links und Webadressen, Link über die Werkzeugleiste, Webadresse einfügen
     (auch über markierten Text), Strg+Klick im Editor öffnet einen neuen Tab.

8. **Verlassen mit ungespeicherten Änderungen** (`e2e/unsaved-changes.e2e.ts`): Seitenbaum,
   „Abbrechen“ und Zurück-Taste fragen per Dialog, Tab schließen/neu laden über die Abfrage des
   Browsers. Nicht gefragt wird ohne Änderungen (auch auf Seiten mit Tabellen, Code, Diagrammen,
   Dateien), nach dem Rückgängigmachen aller Änderungen, beim Speichern und beim Löschen. Nach
   einem abgelehnten Speichern (Konflikt) wird weiter gefragt.

### Eingaben im Editor-Test

Die Tests tippen im Tempo eines schnellen Menschen (`type`/`press` in `e2e/helpers.ts`), nicht
so schnell wie Playwright kann. Grund: Der Browser meldet Cursorbewegungen asynchron, und
ProseMirror übernimmt kurz nach einem Klick (50 ms) oder Fokus (20 ms) bewusst seine eigene
Cursorposition. Ohne Pausen „findet“ ein Test Fehler, die kein Mensch auslösen kann — z. B.
Enter trennt einen Absatz eine Stelle zu früh. Mit realistischem Tempo verhalten sich Tests
und Menschen gleich.

## Ergebnisse der Prüfrunde

| #   | Fehler                                                                                                                                                                                                                                                        | Schwere | Test                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| 1   | Der PDF-Export schickte sein internes Token an **jeden** Server, von dem eine Seite etwas lädt (z. B. ein eingebundenes Bild). Mit dem Token kam man an `AUTH_MODE=read-only`/`full` vorbei, auch schreibend.                                                 | hoch    | `e2e/regressions.e2e.ts` – „sends its internal token to no other server“ |
| 2   | Uploads über 512 KB scheiterten im Produktionsserver/Docker mit 413, obwohl 10 MB erlaubt sind (`BODY_SIZE_LIMIT` von adapter-node nicht gesetzt).                                                                                                            | hoch    | `e2e/regressions.e2e.ts`, `attachment-limits.spec.ts`                    |
| 3   | Wiki-Link-Syntax in Code wurde zu Links: `if [[ -f "$datei" ]]` in einem Shell-Block wurde verfälscht (Seite, Verlauf, PDF).                                                                                                                                  | mittel  | `wiki-links.spec.ts`, `e2e/regressions.e2e.ts`                           |
| 4   | `[[Seite\|Text]]` in einer Tabellenzelle (Milkdown schreibt `\|`) führte zu einer nicht existierenden Seite „Seite\\“.                                                                                                                                        | mittel  | `wiki-links.spec.ts`                                                     |
| 5   | `[[Seite#Abschnitt]]` legte eine neue Seite „seite-abschnitt“ an statt zum Abschnitt zu springen.                                                                                                                                                             | mittel  | `wiki-links.spec.ts`                                                     |
| 6   | Seitenbaum: Nach Navigation über einen Link in einen zugeklappten Ordner blieb die geöffnete Seite unsichtbar.                                                                                                                                                | niedrig | `e2e/regressions.e2e.ts` – „page tree reveals a page“                    |
| 7   | Suchtext/Snippets behielten Backslashes escapter Zeichen (`snake\case`).                                                                                                                                                                                      | niedrig | `search/text.spec.ts`                                                    |
| 8   | `Content-Disposition` enthielt `'()*` unkodiert (RFC 5987).                                                                                                                                                                                                   | niedrig | `attachment-headers.spec.ts`                                             |
| 9   | **„/“-Menü:** Ruht die Maus dort, wo das Menü aufgeht, sprang die Hervorhebung beim Pfeilen (Einträge übersprungen, zurück), und Enter fügte etwas anderes ein als hervorgehoben — die Liste scrollt unter der Maus, der Browser meldet den Eintrag darunter. | mittel  | `e2e/editor.e2e.ts` – „arrow keys move the highlight …“                  |
| 10  | **Datenverlust:** Wer innerhalb von ~150 ms nach dem letzten Tastendruck auf „Speichern“ klickte, verlor die letzten Zeichen (der Formularwert folgt dem Editor erst nach 200 ms).                                                                            | hoch    | `e2e/editor.e2e.ts` – „typed right before saving“                        |
| 11  | Das Absatzformat-Menü („Text ▾“) in der Werkzeugleiste ging per Maus gar nicht auf.                                                                                                                                                                           | mittel  | `e2e/editor.e2e.ts` – „paragraph format“                                 |
| 12  | Getippte Links `[Text](https://…)`, Bilder `![Alt](…)` und Webadressen blieben Text, nur eingefügte Adressen wurden zu Links. Eine Adresse über markierten Text eingefügt ersetzte den Text statt ihn zu verlinken.                                           | mittel  | `link-syntax.spec.ts`, `e2e/editor.e2e.ts` (Kürzel, Verlinken)           |

Neue Regressionstests ohne gefundenen Fehler: `e2e/auth-modes.e2e.ts` (Zugriffsregeln
in `read-only` und `full`, PDF-Export mit Login in `full`) und der Großteil von
`e2e/editor.e2e.ts`.

Geprüft, aber nicht behoben:

- Bei extrem schnellem Tippen (unter ~30 ms pro Taste, 1 von 80 Versuchen bei 10 ms) landet
  der erste Buchstabe nach `- ` am Ende des neuen Listenpunkts. Ein Rennen in Crepes
  Listen-Darstellung; ab 30 ms nie aufgetreten.
- Markiert man Text in der ersten Zeile, legt sich Crepes schwebende Formatierungsleiste über
  den linken Teil der festen Werkzeugleiste. Das ist normales Popup-Verhalten, die Leiste hat
  dieselben Knöpfe. Popups unter die Werkzeugleiste zu legen wäre schlechter: Das „/“-Menü
  klappt bei wenig Platz nach oben auf und würde dann von ihr zerschnitten.
- Ein Wiederholungslauf (`--repeat-each=3`) der Editor- und Regressionstests lief ohne Ausfälle.

## Offen / nicht abgedeckt

- **PostgreSQL** wird von keinem Test ausgeführt; die `*.pg.ts`-Repositories sind nur
  durch Typprüfung abgesichert. Ein CI-Job mit Postgres-Service wäre der nächste Schritt.
- `POST /api/files` meldet jeden Datenbankfehler als „Seite nicht gefunden“.
- Mobile Ansicht und Dunkelmodus werden nicht automatisiert geprüft.
- Zwischenablage wird im Test per `paste`-Ereignis nachgestellt, nicht über das echte
  Strg+V des Betriebssystems.

## Ausführen

```sh
npm run test:unit -- --run   # Vitest
npm run test:e2e             # Playwright: baut und startet die drei Server selbst
```
