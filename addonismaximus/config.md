# Addonis Maximus settings

You normally edit these from inside the panel: on Anki's deck-browser home
screen, find the **Addonis Maximus** progress panel and click its **gear icon**.
This JSON is the same data, for advanced edits. Unknown keys are ignored and
missing keys fall back to their defaults, so it is safe to edit a subset.

## appearance

- **theme** — `strava`, `midnight`, `aurora`, `violet`, or `daylight`.
- **chart** — trend chart style: `area` or `bar`.
- **corners** — `round` or `sharp`.
- **textScale** — master size multiplier for the whole panel (`1` = default).
  The Text size control uses `0.85` / `1` / `1.2` / `1.4`.
- **viewMode** — `multi` (default) stacks three blocks: goal rings, trend graph
  and heat-map. `single` is the swipe carousel: one card at a time, with arrows,
  dots and swipe.
- **stageHeight** — carousel card height in pre-zoom px (`single` mode only).
  The Card height control uses `320` / `420` / `520`.
- **blocks** — which card fills each of `multi` mode's three slots, by card key
  (default `["goals", "activity", "streak"]`). The pencil in a block's corner
  rewrites this.

## sections

These govern **`single` mode only**. In the default `multi` view the three panels
come from `appearance.blocks` above — reordering or unhiding something here will
appear to do nothing until you switch View mode to Single card.

- **order** — the order cards appear in, by key.
- **hidden** — keys of cards to hide.
- **defaultCard** — which card the carousel opens on. Falls back to the first
  visible card if this one is hidden or unknown.

Card keys: `goals`, `activity`, `overview`, `month`, `streak`, `pending`,
`pace`, `forecast`, `answerButtons`, `hourly`, `bestDays`, `maturity`, `time`.

The add-on ships lean — only `goals`, `activity`, `overview`, `month`, `streak`
and `pending` start enabled; turn the rest on in Settings → Cards & sections.

## goals

Each entry: `label`, `icon`, `source` (`total` / `reviews` / `newC` / `time` /
`daysStudied`), `unit` (`count` / `time` / `days`), `targetMode`, and
`weeklyTarget` (seconds for time goals, otherwise a count).

- **targetMode** — `average` tracks your own recent weekly average for that
  source; `fixed` uses `weeklyTarget`. Day/month/year targets scale automatically.

## data

- **includeDecks** — deck names to include; empty `[]` means all decks.
- **cutoffHour** — hour a new study day starts; `null` uses Anki's rollover.
- **matureThresholdDays** — interval at which a card counts as mature.
- **streakMinCards** — minimum cards in a day to keep a streak alive.
- **excludeSuspended** — drop suspended cards from the deck-maturity figures.

## other

- **maturity.deck** — which deck the Deck maturity ETA card tracks;
  `""` auto-picks your largest deck.
- **ui.range** — remembered Week/Month/Year toggle state, not a setting you need
  to edit; the panel rewrites it as you click.
- **version** — config schema version; leave it alone.
