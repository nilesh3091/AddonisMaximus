/* App shell: topbar, header, range toggle, grid, tweaks. */
const { useTweaks, TweaksPanel, TweakSection, TweakRadio } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "strava",
  "chart": "area",
  "corners": "round"
}/*EDITMODE-END*/;

const THEME_OPTS = [
  { value: "strava", label: "Strava" },
  { value: "midnight", label: "Midnight" },
  { value: "aurora", label: "Aurora" },
  { value: "violet", label: "Violet" },
  { value: "daylight", label: "Daylight" },
];

function RangeToggle({ value, onChange }) {
  return (
    <div className="range-toggle">
      {["week", "month", "year"].map((r) => (
        <button key={r} className={value === r ? "active" : ""} onClick={() => onChange(r)}>
          {r[0].toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [range, setRange] = React.useState("week");

  React.useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", t.theme);
    el.setAttribute("data-chart", t.chart);
    el.setAttribute("data-radius", t.corners === "sharp" ? "sharp" : "round");
  }, [t.theme, t.chart, t.corners]);

  const A = window.ANKI;

  return (
    <div className="app-shell">
      {/* faux Anki desktop top bar */}
      <div className="topbar">
        <div className="brand"><span className="mark"><Icon name="brain" size={14} sw={2} /></span>Addonis Maximus</div>
        <nav>
          <a>Decks</a><a>Add</a><a>Browse</a><a className="active">Progress</a>
        </nav>
        <div className="spacer" />
        <div className="sync"><Icon name="rotate" size={14} /> Synced just now</div>
      </div>

      <div className="page">
        <div className="wrap">
          <div className="phead">
            <div>
              <h1>
                Your Progress
                <span className="streak-pill"><span className="flame"><Icon name="flame" size={15} fill="currentColor" sw={1.4} /></span>{A.streakDays}-day streak</span>
              </h1>
              <div className="sub">A Strava-style view of everything you study in Anki.</div>
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>

          <div className="grid">
            <div className="col-12"><GoalsCard range={range} /></div>

            <div className="col-7"><ActivityCard range={range} chartType={t.chart} /></div>
            <div className="col-5"><StreakCard /></div>

            <div className="col-7"><ForecastCard /></div>
            <div className="col-5"><AnswerButtonsCard range={range} /></div>

            <div className="col-5"><HourlyCard /></div>
            <div className="col-7"><FsrsCard /></div>

            <div className="col-7"><DeckBoardCard range={range} /></div>
            <div className="col-5"><RecordsCard /></div>

            <div className="col-12"><AchievementsCard /></div>
          </div>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Color theme" value={t.theme} options={THEME_OPTS}
          onChange={(v) => setTweak("theme", v)} />
        <TweakSection label="Charts & shape" />
        <TweakRadio label="Trend style" value={t.chart} options={[{ value: "area", label: "Area" }, { value: "bar", label: "Bars" }]}
          onChange={(v) => setTweak("chart", v)} />
        <TweakRadio label="Corners" value={t.corners} options={[{ value: "round", label: "Round" }, { value: "sharp", label: "Sharp" }]}
          onChange={(v) => setTweak("corners", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
