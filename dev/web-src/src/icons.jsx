/* Stroke icon set. <Icon name size /> — currentColor stroke. */
export const Icon = ({ name, size = 18, sw = 2, style, fill = "none" }) => {
  const P = {
    fill, stroke: "currentColor", strokeWidth: sw,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    flame: <path {...P} d="M12 3c.5 3-1.5 4-2.5 5.5C8 10.5 7 12 7 14a5 5 0 0 0 10 0c0-2-1-3.2-1.8-4.2-.6 1-1.2 1.5-2 1.7.4-2.6-.2-5.5-1.2-8.5Z" />,
    layers: <g {...P}><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /></g>,
    repeat: <g {...P}><path d="m17 2 3 3-3 3" /><path d="M3 11V9a4 4 0 0 1 4-4h13" /><path d="m7 22-3-3 3-3" /><path d="M21 13v2a4 4 0 0 1-4 4H4" /></g>,
    plus: <g {...P}><path d="M12 5v14M5 12h14" /></g>,
    seedling: <g {...P}><path d="M12 21v-7" /><path d="M12 14c0-3 2-5 5-5-.3 3-2 5-5 5Z" /><path d="M12 14c0-3-2-5-5-5 .3 3 2 5 5 5Z" /></g>,
    rotate: <g {...P}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></g>,
    clock: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
    check: <path {...P} d="m4.5 12.5 5 5 10-11" />,
    target: <g {...P}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></g>,
    calendar: <g {...P}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></g>,
    flag: <g {...P}><path d="M5 21V4M5 4h11l-2 3.5L16 11H5" /></g>,
    sun: <g {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></g>,
    globe: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></g>,
    bolt: <path {...P} d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
    shield: <g {...P}><path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 7.8 7.5 9.5 4.4-1.7 7.5-4.9 7.5-9.5v-6L12 2.5Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></g>,
    crown: <path {...P} d="M3 7l4 4 5-7 5 7 4-4-1.5 12h-15L3 7Z" />,
    moon: <path {...P} d="M20 13a8 8 0 1 1-9-9 7 7 0 0 0 9 9Z" />,
    star: <path {...P} d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.8 6.4 20.3l1.2-6.2L3 9.8l6.3-.8L12 3Z" />,
    infinity: <path {...P} d="M6.5 9a3.5 3.5 0 1 0 0 6c2.5 0 3-3 5.5-3s3 3 5.5 3a3.5 3.5 0 1 0 0-6c-2.5 0-3 3-5.5 3s-3-3-5.5-3Z" />,
    share: <g {...P}><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="5.5" r="2.5" /><circle cx="17" cy="18.5" r="2.5" /><path d="m8.2 10.8 6.6-3.8M8.2 13.2l6.6 3.8" /></g>,
    brain: <g {...P}><path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.5 2.5 0 0 0-1 4.8M9.5 4.5A2.2 2.2 0 0 1 12 6.5v13M9.5 4.5C8 4.5 7 9 7 12s1 7.5 2.5 7.5" /><path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 1 4.8M14.5 4.5A2.2 2.2 0 0 0 12 6.5M14.5 4.5C16 4.5 17 9 17 12s-1 7.5-2.5 7.5A2.2 2.2 0 0 1 12 17.3" /></g>,
    chevronDown: <path {...P} d="m6 9 6 6 6-6" />,
    chevronUp: <path {...P} d="m6 15 6-6 6 6" />,
    chevronL: <path {...P} d="m15 6-6 6 6 6" />,
    chevronR: <path {...P} d="m9 6 6 6-6 6" />,
    trophy: <g {...P}><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 19h6M10 16h4M12 13v3" /></g>,
    lock: <g {...P}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>,
    cards: <g {...P}><rect x="3" y="7" width="13" height="14" rx="2" /><path d="M7 4h10a2 2 0 0 1 2 2v11" /></g>,
    gauge: <g {...P}><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-5" /></g>,
    spark: <path {...P} d="M12 2v6M12 16v6M2 12h6M16 12h6" />,
    // ---- UI / settings glyphs -------------------------------------------
    gear: <g {...P}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H4a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 5.65 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 8.08 3.84l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1.03-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1.03H22a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" /></g>,
    x: <path {...P} d="M6 6l12 12M18 6 6 18" />,
    trash: <g {...P}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></g>,
    eye: <g {...P}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></g>,
    eyeOff: <g {...P}><path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.7A17 17 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 4.2-1M3 3l18 18M9.5 9.6a3 3 0 0 0 4.2 4.2" /></g>,
    database: <g {...P}><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></g>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};
