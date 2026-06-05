# Recall — Progress settings

You normally edit these from inside the panel: open **Tools → Recall — Progress**,
then click the **gear icon** (top-left). This JSON is the same data, for advanced
edits.

- **appearance.theme** — `strava`, `midnight`, `aurora`, `violet`, or `daylight`.
- **appearance.chart** — trend chart style: `area` or `bar`.
- **appearance.corners** — `round` or `sharp`.
- **sections.order** — the order cards appear in the panel.
- **sections.hidden** — keys of cards to hide.
- **goals[]** — each goal: `label`, `source` (`total`/`reviews`/`newC`/`time`/`daysStudied`),
  `unit` (`count`/`time`/`days`), and `weeklyTarget` (seconds for time goals, else a count).
  Monthly/yearly targets scale automatically.
- **data.includeDecks** — deck names to include; empty `[]` means all decks.
- **data.cutoffHour** — hour a new study day starts; `null` uses Anki's rollover.
- **data.matureThresholdDays** — interval at which a card counts as mature.
- **data.streakMinCards** — minimum cards in a day to keep a streak alive.
