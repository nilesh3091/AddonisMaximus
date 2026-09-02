# Addonis Maximus 📈🎯

An Anki add-on: a Strava-style study-progress dashboard with goal tracking, rendered
as an embedded web view on Anki's deck-browser home screen — goal rings, an activity
trend graph and a 12-month study heat-map, plus a library of extra cards you can swap in.

**Install:** [AnkiWeb #306644033](https://ankiweb.net/shared/info/306644033) — in Anki: Tools → Add-ons → Get Add-ons → code `306644033`

Settings live behind the **gear icon** on the panel itself (cards & order, goals,
appearance, and which decks to count).

## Layout

- `addonismaximus/` — the add-on itself (what Anki loads, and what ships to AnkiWeb)
- `dev/` — web UI sources (React + esbuild), tooling, and design assets; not shipped

## License

AGPL-3.0, same license family as Anki itself. See [LICENSE](LICENSE).
