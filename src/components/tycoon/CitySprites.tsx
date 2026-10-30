"use client";
import { memo } from "react";
export type Ride = "gwagon" | "lamborghini" | "cybertruck";
export function Car({ kind, paint = "#d3aa50" }: { kind: Ride; paint?: string }) {
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
export function Person({
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
export function Tree({
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
export const Building = memo(function Building({
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
});
