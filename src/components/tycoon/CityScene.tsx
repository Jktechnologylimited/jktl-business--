"use client";
import { useEffect, useRef, useState } from "react";
import { ventures, type TycoonState } from "@/lib/tycoon";
import styles from "./CityScene.module.css";
type Ride = "gwagon" | "lamborghini" | "cybertruck";
function Car({ kind, paint = "#d3aa50" }: { kind: Ride; paint?: string }) {
  return (
    <g data-car={kind}>
      {kind === "gwagon" ? (
        <>
          <rect x="-18" y="-9" width="36" height="18" rx="3" fill={paint} />
          <rect x="-9" y="-7" width="18" height="14" rx="2" fill="#162538" />
          <rect x="-2" y="-6" width="10" height="12" fill={paint} />
          <rect x="-19" y="-6" width="3" height="12" rx="2" fill="#252c35" />
          <path d="M15 -6v12" stroke="#eee" strokeWidth="3" />
        </>
      ) : kind === "lamborghini" ? (
        <>
          <path
            d="M-23 -7L-10 -10L17 -8L25 -3V3L17 8L-10 10L-23 7Z"
            fill={paint}
          />
          <path d="M-10 -7L4 -7L12 -4V4L4 7L-10 7L-4 0Z" fill="#23384b" />
          <path d="M20 -6l2 3M20 6l2 -3" stroke="#fff7bf" strokeWidth="2" />
          <path d="M-18 -10v20" stroke="#172432" strokeWidth="3" />
        </>
      ) : (
        <>
          <path d="M-24 -9L9 -10L24 -6V6L9 10L-24 9Z" fill="#b5c4cd" />
          <path d="M-11 -8L4 -8L14 0L4 8L-11 8Z" fill="#263b4a" />
          <path d="M-21 -7H-12V7H-21Z" fill="#4f6270" />
          <path d="M22 -5v10" stroke="#f7ffff" strokeWidth="2" />
        </>
      )}
      <path
        d="M-12 -11h8M-12 11h8M10 -11h7M10 11h7"
        stroke="#1b2731"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="36" rx="20" ry="6" fill="#fff8c4" opacity=".12" />
    </g>
  );
}
function Person({
  shirt = "#e9b650",
  skin = "#714835",
}: {
  shirt?: string;
  skin?: string;
}) {
  return (
    <g data-person="customer">
      <ellipse cx="1" cy="7" rx="5" ry="2" fill="#102218" opacity=".16" />
      <path d="M-2 2v7" stroke="#263a49" strokeWidth="2" strokeLinecap="round">
        <animate
          attributeName="d"
          values="M-2 2l-2 6;M-2 2l2 6;M-2 2l-2 6"
          dur=".8s"
          repeatCount="indefinite"
        />
      </path>
      <path d="M2 2v7" stroke="#263a49" strokeWidth="2" strokeLinecap="round">
        <animate
          attributeName="d"
          values="M2 2l2 6;M2 2l-2 6;M2 2l2 6"
          dur=".8s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M-5 -1L-3 -6H3L5 -1"
        stroke={shirt}
        strokeWidth="3"
        fill={shirt}
      />
      <circle cy="-9" r="3" fill={skin} />
      <path d="M-3 -10q3 -5 6 0" stroke="#252128" strokeWidth="2" />
    </g>
  );
}
function Tree({
  x,
  y,
  small = false,
}: {
  x: number;
  y: number;
  small?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? 0.7 : 1})`}>
      <ellipse cy="5" rx="13" ry="6" fill="#274834" opacity=".12" />
      <path d="M0 3V-18" stroke="#8d6b40" strokeWidth="4" />
      <circle cy="-24" r="14" fill="#3e7554" />
      <circle cx="-7" cy="-21" r="9" fill="#4c8861" />
      <circle cx="4" cy="-30" r="8" fill="#64a274" />
    </g>
  );
}
function Building({
  kind,
  level,
  color,
  name,
  night,
}: {
  kind: string;
  level: number;
  color: string;
  name: string;
  night: boolean;
}) {
  const height = 35 + level * 17;
  return (
    <g>
      <ellipse cy="31" rx="74" ry="27" fill="#243c32" opacity=".14" />
      <path
        d={`M-60 18V-${height}L0 -${height + 23}L60 -${height}V18L0 45Z`}
        fill={color}
      />
      <path
        d={`M0 -${height + 23}L60 -${height}L0 -${height - 24}L-60 -${height}Z`}
        fill={kind === "solar" ? "#a9c0cc" : "#f4eddb"}
      />
      <path
        d={`M0 -${height - 24}V45L60 18V-${height}Z`}
        fill="#1c3445"
        opacity=".17"
      />
      {Array.from({ length: level }, (_, j) => (
        <g key={j}>
          <path
            d={`M-47 ${-14 - j * 16}l13 5v10l-13 -5Z M-25 ${-5 - j * 16}l13 5v10l-13 -5Z M13 ${-j * 16}l13 -5v10l-13 5Z M35 ${-9 - j * 16}l13 -5v10l-13 5Z`}
            fill={night ? "#ffe8a5" : "#456c82"}
          />
          <path
            d={`M-40 ${-11 - j * 16}v9 M-18 ${-2 - j * 16}v9 M20 ${-3 - j * 16}v9 M42 ${-12 - j * 16}v9`}
            stroke={night ? "#d5ae58" : "#8fb9c5"}
            strokeWidth="1"
          />
        </g>
      ))}
      <path d="M-13 16v24l13 5V21Z" fill="#253d4e" />
      <path d="M-8 21v14" stroke="#8db5bf" strokeWidth="3" />
      {(kind === "suya" || kind === "provisions" || kind === "salon") && (
        <g>
          <path
            d="M-65 -12L-4 12L0 24L-70 0Z"
            fill={kind === "salon" ? "#9a4e76" : "#c26042"}
          />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${-62 + i * 16} ${-10 + i * 6}l8 3 -5 12 -8 -3Z`}
              fill="#fff2d4"
            />
          ))}
          <path d="M-69 0v24M0 24v21" stroke="#84694c" strokeWidth="2" />
        </g>
      )}
      {kind === "logistics" && (
        <g>
          <path d="M10 15l38 -15v23l-38 15Z" fill="#4e6370" />
          {[7, 12, 17].map((y) => (
            <path
              key={y}
              d={`M12 ${y + 12}l34 -13`}
              stroke="#a2b4bd"
              strokeWidth="1.5"
            />
          ))}
          <path d="M-46 18l16 6v15l-16 -6Z" fill="#e9c790" />
        </g>
      )}
      {kind === "solar" && (
        <g transform={`translate(0 ${-height + 1})`}>
          <path
            d="M-35 -9L-4 -21L35 -6L4 6Z"
            fill="#2b5577"
            stroke="#cbdce4"
            strokeWidth="2"
          />
          <path
            d="M-24 -13l39 15M-13 -17l39 15M-22 -4L8 -16M-9 1L22 -11"
            stroke="#72a8ce"
            strokeWidth="1"
          />
        </g>
      )}
      {kind === "agency" && (
        <g transform={`translate(0 ${-height})`}>
          <path d="M-15 -13L5 -20L20 -14L0 -6Z" fill="#b6c4c2" />
          <path d="M8 -17v-22" stroke="#7a929c" strokeWidth="2" />
          <path
            d="M-1 -32q9 -9 18 0"
            fill="none"
            stroke="#c9a84c"
            strokeWidth="2"
          />
        </g>
      )}
      <path d={`M-53 ${-height + 13}l43 17v10l-43 -17Z`} fill="#f7efd9" />
      <text
        transform={`translate(-33 ${-height + 24}) rotate(21)`}
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="700"
        fill="#263a4a"
      >
        {name.toUpperCase().slice(0, 15)}
      </text>
      {kind === "suya" && (
        <g transform="translate(55 30)">
          <ellipse rx="13" ry="6" fill="#3a454a" />
          <path d="M-10 0v10M10 0v10" stroke="#3a454a" strokeWidth="2" />
          <path d="M-7 -2h14" stroke="#ed9b59" strokeWidth="3" />
          <path
            d="M-3 -7q-7 -8 1 -16"
            stroke="#fff"
            strokeWidth="2"
            fill="none"
            opacity=".6"
          />
        </g>
      )}
      <Tree x={-76} y={12} small />
      <Tree x={77} y={-9} small />
      <g transform="translate(57 52)">
        <circle r="9" fill="#f3e5bb" />
        <circle r="7" fill="#c9a84c" />
        <text
          textAnchor="middle"
          y="3"
          fontSize="9"
          fontWeight="bold"
          fill="#604822"
        >
          {level}
        </text>
      </g>
    </g>
  );
}
export function CityScene({
  state,
  slot,
  onSlot,
}: {
  state: TycoonState;
  slot: number;
  onSlot: (slot: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ride, setRide] = useState<Ride>("gwagon");
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (paused || media.matches) svg.current?.pauseAnimations();
      else svg.current?.unpauseAnimations();
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [paused]);
  const locations = state.plots.map((_, i) => ({
    x: 112 + (i % 4) * 230,
    y: 145 + Math.floor(i / 4) * 202,
  }));
  return (
    <div className={`${styles.scene} ${night ? styles.night : ""}`}>
      <div className={styles.toolbar}>
        <span>
          <i />
          LIVE NEIGHBOURHOOD
        </span>
        <div>
          <button onClick={() => setNight(!night)} aria-pressed={night}>
            {night ? "☀ Day" : "☾ Night"}
          </button>
          <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
            {paused ? "▶ Resume" : "Ⅱ Pause"}
          </button>
          <button
            aria-label="Zoom out city"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            −
          </button>
          <button
            aria-label="Zoom in city"
            disabled={zoom >= 1.75}
            onClick={() => setZoom(Math.min(1.75, zoom + 0.25))}
          >
            +
          </button>
        </div>
      </div>
      <div
        className={styles.viewport}
        tabIndex={0}
        aria-label="City map. Scroll to explore when zoomed."
      >
        <svg
          ref={svg}
          className={styles.city}
          style={{ width: `${zoom * 100}%` }}
          viewBox="0 0 920 740"
          role="group"
          aria-label="Interactive 2D Nigerian business city. Select a plot to build or upgrade."
        >
          <defs>
            <pattern
              id="city-grass"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect
                width="24"
                height="24"
                fill={night ? "#536d62" : "#a8c58a"}
              />
              <path
                d="M5 9l2 -3M17 19l2 -3"
                stroke={night ? "#607a69" : "#b9d29e"}
                strokeWidth="2"
              />
            </pattern>
            <linearGradient id="city-sky">
              <stop stopColor={night ? "#172943" : "#dce9e9"} />
              <stop offset="1" stopColor={night ? "#3c4c66" : "#f2ebcf"} />
            </linearGradient>
            <filter id="city-shadow">
              <feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity=".12" />
            </filter>
          </defs>
          <rect width="920" height="740" fill="url(#city-grass)" />
          <path d="M0 0H920V58H0Z" fill="url(#city-sky)" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <g key={i} opacity=".45">
              <rect
                x={i * 84 - 15}
                y={10 + (i % 3) * 10}
                width={55 + (i % 2) * 20}
                height={48}
                fill={night ? "#152c43" : "#80989a"}
              />
              <path
                d={`M${i * 84 + 2} 24v5m8 -5v5m8 -5v5m-16 5v5m8 -5v5m8 -5v5`}
                stroke={night ? "#e7cc83" : "#b9d1ce"}
                strokeWidth="3"
              />
            </g>
          ))}
          <path
            d="M0 75H920M0 263H920M0 465H920M0 670H920M225 58V740M455 58V740M685 58V740"
            stroke={night ? "#9b9d8b" : "#d5d3ba"}
            strokeWidth="66"
          />
          <path
            d="M0 75H920M0 263H920M0 465H920M0 670H920M225 58V740M455 58V740M685 58V740"
            stroke={night ? "#34424f" : "#606f77"}
            strokeWidth="46"
          />
          <path
            d="M0 75H920M0 263H920M0 465H920M0 670H920M225 58V740M455 58V740M685 58V740"
            stroke="#c9c8b3"
            strokeWidth="1.5"
            strokeDasharray="10 12"
          />
          {[225, 455, 685].flatMap((x) =>
            [263, 465, 670].map((y) => (
              <g key={`${x}-${y}`}>
                <path
                  d={`M${x - 37} ${y - 17}v34m-5 -34v34M${x + 37} ${y - 17}v34m5 -34v34`}
                  stroke="#e6e8de"
                  strokeWidth="3"
                />
                <rect
                  x={x - 33}
                  y={y - 33}
                  width="5"
                  height="13"
                  rx="2"
                  fill="#283b43"
                />
                <circle cx={x - 30.5} cy={y - 29} r="1.5" fill="#e9b650" />
                {night && (
                  <circle
                    cx={x - 29}
                    cy={y - 30}
                    r="32"
                    fill="#ffe7a2"
                    opacity=".08"
                  />
                )}
              </g>
            )),
          )}
          {locations.map(({ x, y }, i) => {
            const p = state.plots[i];
            const v = ventures.find((v) => v.id === p?.kind);
            return (
              <g
                key={i}
                transform={`translate(${x} ${y})`}
                tabIndex={0}
                role="button"
                aria-label={`Plot ${i + 1}: ${v ? `${v.name}, level ${p!.level}` : "empty"}`}
                aria-pressed={slot === i}
                onClick={() => onSlot(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSlot(i);
                  }
                }}
                className={styles.plot}
              >
                <path
                  d="M-91 -15L0 -53L91 -15V62L0 98L-91 62Z"
                  fill={slot === i ? "#dbc785" : night ? "#6c8470" : "#c2d4a7"}
                  stroke={slot === i ? "#f3d994" : "#dce5c6"}
                  strokeWidth={slot === i ? 3 : 1}
                />
                {v ? (
                  <Building
                    kind={v.id}
                    name={v.name}
                    color={v.color}
                    level={p!.level}
                    night={night}
                  />
                ) : (
                  <>
                    <path
                      d="M-67 18L0 -8L67 18V57L0 83L-67 57Z"
                      fill="none"
                      stroke={night ? "#a8bba4" : "#89a47c"}
                      strokeDasharray="5 5"
                    />
                    <text
                      y="32"
                      textAnchor="middle"
                      fontSize="27"
                      fill={night ? "#d9e6d0" : "#64825d"}
                    >
                      +
                    </text>
                    <text
                      y="53"
                      textAnchor="middle"
                      fontSize="8"
                      letterSpacing="1"
                      fill={night ? "#d9e6d0" : "#4e6b49"}
                    >
                      YOUR NEXT VENTURE
                    </text>
                    <Tree x={-65} y={-13} small />
                  </>
                )}
                <rect
                  x="-87"
                  y="77"
                  width="174"
                  height="23"
                  rx="11.5"
                  fill={v ? "#11243a" : "#faf4e0"}
                  stroke="#c9a84c"
                  strokeWidth=".6"
                />
                <text
                  y="92"
                  textAnchor="middle"
                  fontSize="9"
                  fill={v ? "#fff6d9" : "#5d644f"}
                >
                  {v
                    ? `${v.name} · ${moneyShort(v.income * p!.level)}/wk`
                    : `Plot ${i + 1} · tap to build`}
                </text>
              </g>
            );
          })}
          <g aria-hidden="true" className={styles.traffic}>
            {(
              [
                {
                  kind: "gwagon",
                  paint: "#252b35",
                  path: "M-50 253H970",
                  duration: 18,
                  begin: -8,
                },
                {
                  kind: "lamborghini",
                  paint: "#e9bc36",
                  path: "M970 476H-50",
                  duration: 13,
                  begin: -3,
                },
                {
                  kind: "cybertruck",
                  paint: "#a8b8c4",
                  path: "M970 86H-50",
                  duration: 20,
                  begin: -13,
                },
                {
                  kind: ride,
                  paint: "#c7a359",
                  path: "M444 790V-50",
                  duration: 23,
                  begin: -11,
                },
                {
                  kind: "gwagon",
                  paint: "#e8e2d3",
                  path: "M696 -50V790",
                  duration: 27,
                  begin: -5,
                },
                {
                  kind: "lamborghini",
                  paint: "#c7694a",
                  path: "M-50 659H970",
                  duration: 16,
                  begin: -10,
                },
              ] as {
                kind: Ride;
                paint: string;
                path: string;
                duration: number;
                begin: number;
              }[]
            ).map((car, i) => (
              <g key={`${i}-${car.kind}`}>
                <Car kind={car.kind} paint={car.paint} />
                <animateMotion
                  path={car.path}
                  dur={`${car.duration}s`}
                  begin={`${car.begin}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                />
              </g>
            ))}
            {locations.flatMap(({ x, y }, i) =>
              state.plots[i]
                ? [0, 1, 2].map((n) => (
                    <g key={`${i}-${n}`} opacity="0">
                      <Person
                        shirt={["#dcac50", "#7b9dab", "#b96b5a"][(i + n) % 3]}
                        skin={["#724835", "#9c6b4e", "#52362d"][i % 3]}
                      />
                      <animateMotion
                        path={`M${x - 88} ${y + 111}L${x - 25} ${y + 111}L${x - 13} ${y + 56}L${x - 9} ${y + 37}L${x - 13} ${y + 56}L${x - 25} ${y + 111}L${x + 88} ${y + 111}`}
                        dur={`${20 + n * 5}s`}
                        begin={`${-i * 2 - n * 7}s`}
                        repeatCount="indefinite"
                        rotate="0"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;1;1;0;0;1;1;0"
                        keyTimes="0;.05;.35;.43;.56;.64;.95;1"
                        dur={`${20 + n * 5}s`}
                        begin={`${-i * 2 - n * 7}s`}
                        repeatCount="indefinite"
                      />
                    </g>
                  ))
                : [],
            )}
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={`street-${i}`}>
                <Person shirt={["#f4df9c", "#6e9bca", "#a681ac"][i % 3]} />
                <animateMotion
                  path={i % 2 ? "M193 760V42" : "M-20 702H950"}
                  dur={`${55 + i * 6}s`}
                  begin={`${-i * 11}s`}
                  repeatCount="indefinite"
                />
              </g>
            ))}
          </g>
          {[
            { x: 38, y: 713 },
            { x: 852, y: 713 },
            { x: 38, y: 42 },
            { x: 850, y: 42 },
          ].map((p, i) => (
            <Tree key={i} {...p} />
          ))}
          <g transform="translate(64 708)">
            <rect
              x="-24"
              y="-12"
              width="95"
              height="23"
              rx="5"
              fill="#f7efd7"
            />
            <text x="23" y="3" textAnchor="middle" fontSize="9" fill="#324f45">
              {state.city.toUpperCase()}
            </text>
          </g>
        </svg>
      </div>
      <div className={styles.legend}>
        <span>Walking customers · moving traffic · growing ambition</span>
        <label>
          Featured ride
          <select
            aria-label="Featured luxury car"
            value={ride}
            onChange={(e) => setRide(e.target.value as Ride)}
          >
            <option value="gwagon">G-Wagon style SUV</option>
            <option value="lamborghini">Lamborghini style supercar</option>
            <option value="cybertruck">Cybertruck style pickup</option>
          </select>
        </label>
      </div>
    </div>
  );
}
function moneyShort(n: number) {
  return `₦${Math.round(n / 1000)}k`;
}
