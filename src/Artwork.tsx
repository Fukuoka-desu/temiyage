import { useId } from "react";
export function Emblem({ gift = false }: { gift?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {gift ? (
        <g stroke="currentColor" strokeWidth="2">
          <path d="M12 28h40v27H12zM9 20h46v10H9zM32 20v35" />
          <path d="M32 20C9 20 19 0 28 12l4 8c23 0 13-20 4-8z" />
        </g>
      ) : (
        <>
          <circle cx="32" cy="32" r="29" stroke="#b8955a" strokeWidth="2" />
          <circle cx="32" cy="32" r="25" stroke="#b8955a" />
          <rect
            x="23"
            y="19"
            width="19"
            height="27"
            rx="3"
            stroke="#b13e29"
            strokeWidth="2"
          />
          <text x="26" y="38" fill="#b13e29" fontSize="17" fontFamily="serif">
            贈
          </text>
        </>
      )}
    </svg>
  );
}
export function Flower() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse
            key={a}
            cx="32"
            cy="21"
            rx="10"
            ry="17"
            transform={`rotate(${a} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="5" />
      </g>
    </svg>
  );
}
export function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    pin: "M12 21S4 13 4 9a8 8 0 0 1 16 0c0 4-8 12-8 12ZM12 6v5",
    calendar: "M4 5h16v16H4zM4 10h16M8 2v6M16 2v6M8 14h2M14 14h2M8 18h2",
    gift: "M4 10h16v11H4zM2 6h20v5H2zM12 6v15M12 6C1 6 7-3 12 6c11 0 5-9 0 0",
    star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
    yen: "m5 3 7 9 7-9M5 12h14M5 16h14M12 12v10",
    share: "M12 16V2m-5 5 5-5 5 5M4 12v9h16v-9",
    sliders: "M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M9 15v6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] || paths.gift} />
    </svg>
  );
}
export function Artwork({ genre }: { genre: string }) {
  const id = useId().replace(/:/g, "");
  const kind = genre.includes("和菓子")
    ? "wagashi"
    : genre.includes("洋菓子")
      ? "cake"
      : genre.includes("チョコ")
        ? "choco"
        : genre.includes("酒")
          ? "sake"
          : genre.includes("日本茶")
            ? "tea"
            : genre.includes("コーヒー") || genre.includes("紅茶")
              ? "coffee"
              : genre.includes("果物")
                ? "fruit"
                : genre.includes("供") || genre.includes("つまみ")
                  ? "bowl"
                  : "gift";
  return (
    <div className={`artwork art-${kind}`}>
      <svg viewBox="0 0 320 170" aria-hidden="true">
        <defs>
          <pattern id={id} width="40" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M-20 24a40 40 0 0 1 80 0M-10 24a30 30 0 0 1 60 0M0 24a20 20 0 0 1 40 0M10 24a10 10 0 0 1 20 0"
              fill="none"
              stroke="currentColor"
              strokeOpacity=".1"
            />
          </pattern>
          <filter id={`${id}shadow`}>
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".12" />
          </filter>
        </defs>
        <path fill={`url(#${id})`} d="M0 0h320v170H0z" />
        <ellipse
          cx="160"
          cy="141"
          rx="90"
          ry="8"
          fill="currentColor"
          opacity=".08"
        />
        <g
          filter={`url(#${id}shadow)`}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        >
          {kind === "wagashi" ? (
            <>
              <ellipse cx="160" cy="121" rx="76" ry="16" fill="#f8f1e4" />
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse
                  key={a}
                  cx="159"
                  cy="77"
                  rx="22"
                  ry="31"
                  fill="#d99c9d"
                  transform={`rotate(${a} 159 91)`}
                />
              ))}
              <circle cx="159" cy="91" r="10" fill="#d3b16d" />
              <path d="M203 117q25-38 44-18-12 30-44 18" fill="#8c9b79" />
            </>
          ) : kind === "cake" ? (
            <>
              <ellipse cx="160" cy="97" rx="66" ry="43" fill="#bd8653" />
              <path d="M94 86v22c0 55 132 55 132 0V86" fill="#d4a365" />
              <ellipse cx="160" cy="85" rx="66" ry="43" fill="#efd397" />
              {[51, 41, 31].map((r) => (
                <ellipse
                  key={r}
                  cx="160"
                  cy="85"
                  rx={r}
                  ry={r * 0.65}
                  fill="none"
                  stroke="#b9884b"
                />
              ))}
              <ellipse cx="160" cy="85" rx="20" ry="13" fill="#8b6340" />
            </>
          ) : kind === "choco" ? (
            <>
              {[0, 1, 2].map((x) =>
                [0, 1].map((y) => (
                  <path
                    key={`${x}${y}`}
                    d={`M${100 + x * 43} ${53 + y * 42}h38v35h-38z`}
                    fill={x === 1 ? "#906554" : "#614335"}
                  />
                )),
              )}
            </>
          ) : kind === "sake" ? (
            <>
              <path
                d="M139 29h27v33l15 23v48q-22 13-57 0V85l15-23Z"
                fill="#f5ecdc"
              />
              <path d="M138 27h29v10h-29" fill="#42576b" />
              <path d="M127 94h51v24h-51" fill="#42576b" />
              <path d="M194 107h34l-5 27h-24Z" fill="#e5dfce" />
            </>
          ) : kind === "coffee" || kind === "tea" ? (
            <>
              <ellipse cx="154" cy="131" rx="70" ry="11" fill="#f8f1e4" />
              {kind === "coffee" && (
                <path
                  d="M195 77h14c28 0 20 40-13 35"
                  fill="none"
                  strokeWidth="7"
                />
              )}
              <path
                d="M106 72h94l-8 42q-37 30-78 0Z"
                fill={kind === "tea" ? "#bac5a4" : "#f7eddb"}
              />
              <ellipse
                cx="153"
                cy="72"
                rx="47"
                ry="12"
                fill={kind === "tea" ? "#7f9257" : "#694c3b"}
              />
              <path
                d="M140 51q-10-10 0-20m22 20q-10-10 0-20"
                fill="none"
                strokeOpacity=".4"
              />
            </>
          ) : kind === "fruit" ? (
            <>
              <circle cx="139" cy="98" r="37" fill="#cf926b" />
              <circle cx="185" cy="102" r="31" fill="#dfb56e" />
              <path
                d="M140 62q7-27 29-17-7 21-29 17M184 71l5-19"
                fill="#839575"
              />
            </>
          ) : kind === "bowl" ? (
            <>
              <ellipse cx="159" cy="87" rx="65" ry="20" fill="#f2e6cd" />
              <path
                d="M94 87q10 57 65 56 55 1 65-56-65 32-130 0"
                fill="#778c89"
              />
              <path d="m115 86 18-15 15 13 20-17 32 18-42 11Z" fill="#a88a53" />
            </>
          ) : (
            <>
              <path
                d="M100 96 145 47l24 22 18-22 39 52-15 39H111Z"
                fill="#7e8b9b"
              />
              <path
                d="m100 96 63 13 63-10M163 109l-18-62m18 62 24-62"
                fill="none"
                stroke="#f1deba"
                strokeWidth="2"
              />
              <path
                d="M163 109q-38-29-35-6 8 17 35 6 34-29 34-7-5 18-34 7"
                fill="#eddab9"
              />
            </>
          )}
        </g>
      </svg>
      <span className="art-caption">{genre} の贈りもの</span>
    </div>
  );
}
