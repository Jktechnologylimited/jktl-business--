"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  DoubleSide,
  type Group,
} from "three";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useWorldFeed } from "./useWorldFeed";
import {
  boardItems,
  WEBSITE_BOARD,
  type BoardItem,
} from "@/lib/game-world/model";
function signTexture(item: BoardItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#0c1730";
  c.fillRect(0, 0, 512, 256);
  c.fillStyle = item.kind === "match" ? "#91d5b6" : "#dec47c";
  c.fillRect(0, 0, 512, 6);
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  c.font = `600 20px ${family}`;
  c.fillText(item.label.slice(0, 42), 24, 38);
  c.fillStyle = "#f5f2e8";
  c.font = `600 35px ${family}`;
  let line = "",
    y = 88;
  for (const word of item.title.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (c.measureText(next).width > 464 && line) {
      c.fillText(line, 24, y);
      line = word;
      y += 43;
      if (y > 178) {
        line += "…";
        break;
      }
    } else line = next;
  }
  if (y <= 178) c.fillText(line, 24, y);
  c.font = `400 18px ${family}`;
  c.fillStyle = "#b5bfce";
  c.fillText(item.detail.slice(0, 51), 24, 228);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}
function Sign({ item }: { item: BoardItem }) {
  const texture = useMemo(() => signTexture(item), [item]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <Billboard lockX lockZ>
      <group
        onClick={(e) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          window.open(item.url, "_blank", "noopener,noreferrer");
        }}
      >
        <mesh position={[0, 1.7, 0]}>
          <planeGeometry args={[2.4, 1.2]} />
          <meshBasicMaterial map={texture} side={DoubleSide} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.55, -0.025]}>
            <boxGeometry args={[0.065, 1.1, 0.065]} />
            <meshStandardMaterial color="#626b6c" />
          </mesh>
        ))}
      </group>
    </Billboard>
  );
}
function RoadSign({
  item,
  index,
  read,
}: {
  item: BoardItem;
  index: number;
  read: () => { distance: number };
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current)
      ref.current.position.z =
        ((-25 - index * 75 + read().distance + 155) % 162) - 155;
  });
  return (
    <group ref={ref} position={[index % 2 ? -3.9 : 3.9, 0, -25 - index * 75]}>
      <Sign item={item} />
    </group>
  );
}
export function WorldBillboards({
  low = false,
  read,
}: {
  low?: boolean;
  read?: () => { distance: number };
}) {
  const { feed, now } = useWorldFeed(),
    [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setCycle((n) => n + 1);
    }, 25000);
    return () => clearInterval(timer);
  }, []);
  const items = useMemo(() => boardItems(feed, now), [feed, now]);
  const matches = items.filter((i) => i.kind === "match"),
    news = items.filter((i) => i.kind === "news" || i.kind === "trend");
  const chosen = useMemo(() => {
    const pick = (list: BoardItem[]) =>
      list.length ? list[cycle % list.length] : null;
    const match = pick(matches),
      story = pick(news);
    return [
      WEBSITE_BOARD,
      ...(low
        ? [cycle % 2 ? story || match : match || story]
        : [match, story]
      ).filter((v): v is BoardItem => v !== null),
    ];
  }, [matches, news, cycle, low]);
  const spots: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [-4.5, 0, 5.9],
    [4.5, 0, 5.9],
    [0, 0, -5.9],
  ];
  return (
    <>
      {chosen.map((item, i) =>
        read ? (
          <RoadSign key={i} item={item} index={i} read={read} />
        ) : (
          <group key={i} position={spots[i]}>
            <Sign item={item} />
          </group>
        ),
      )}
    </>
  );
}
