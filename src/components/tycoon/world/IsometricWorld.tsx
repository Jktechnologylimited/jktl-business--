"use client";
import { memo, useState, type ReactNode } from "react";
import { ventures, type TycoonState } from "@/lib/tycoon";
import { Building, Car, Person, Tree, type Ride } from "../CitySprites";
import { anchorStyle, gridToScreen, landPlots, TILE, travel, WORLD, type GridPoint } from "./isometric";
import { useConstruction, useWorldMotion } from "./useWorldMotion";
import styles from "./World.module.css";

type Props = { ready?: boolean; state: TycoonState; selected: number; onTileClick: (row: number, col: number) => void; night: boolean; paused: boolean; ride: Ride };
function Sprite({ point, children, className = "" }: { point: GridPoint; children: ReactNode; className?: string }) {
  return <div className={`${styles.actor} ${className}`} style={anchorStyle(point)}>{children}</div>;
}
function Scaffold() {
  return <svg className={styles.building} viewBox="-110 -180 220 250" aria-hidden="true">
    <path d="M-65 15L0 -17L65 15L0 48Z" fill="#d1bea2" />
    <g fill="none" stroke="#e7ad45" strokeWidth="4" strokeLinejoin="round">
      <path d="M-58 15V-105L0 -132L58 -105V15M0 -132V43M-58 -105L0 -77L58 -105M-58 -55L0 -27L58 -55M-58 -5L0 23L58 -5" />
      <path d="M-58 -105L0 -27M0 -77L-58 -5M58 -105L0 -27M0 -77L58 -5" strokeWidth="2" />
    </g>
    <path d="M-73 20L-10 49M12 49L75 19" stroke="#182d44" strokeWidth="9" strokeDasharray="8 5" />
    <g className={styles.crane}><path d="M65 20V-155H-55M65 -155L98 -141M-20 -155V-100" fill="none" stroke="#f3c455" strokeWidth="5" /><path d="M-25 -100q0 12 10 4" fill="none" stroke="#213950" strokeWidth="3" /></g>
  </svg>;
}
const Terrain = memo(function Terrain() {
  return <>
    <svg className={styles.islandShadow} width={WORLD.width} height={WORLD.height}>
      <polygon points="132,507 1028,955 1028,978 132,530" fill="#aa9471" />
      <polygon points="1796,571 1028,955 1028,978 1796,594" fill="#796c51" />
    </svg>
    {Array.from({ length: 12 * 14 }, (_, id) => {
      const row = Math.floor(id / 14), col = id % 14;
      const p = gridToScreen({ row, col });
      const tone = (row * 13 + col * 7) % 5;
      return <div key={id} className={`${styles.terrain} ${styles[`grass${tone}`]}`} style={{ left: p.x - TILE.width / 2, top: p.y - TILE.height / 2 }} />;
    })}
    <div className={styles.watermark} style={{ left: 430, top: 1000 }}>LAGOS LAGOON · JKTL</div>
  </>;
});
const Roads = memo(function Roads() {
  return <svg width={WORLD.width} height={WORLD.height} aria-hidden="true">
    {[0.5, 3.5, 6.5, 9.5].map(row => {
      const from = gridToScreen({ row, col: -0.4 }), to = gridToScreen({ row, col: 13.4 });
      return <g key={row}><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.curb} /><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.asphalt} /><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.marking} /></g>;
    })}
    {[0.5, 3.5, 6.5, 9.5, 12.5].map(col => {
      const from = gridToScreen({ row: -0.4, col }), to = gridToScreen({ row: 11.4, col });
      return <g key={col}><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.curb} /><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.asphalt} /><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} className={styles.marking} /></g>;
    })}
  </svg>;
});
export function IsometricWorld({ ready = true, state, selected, onTileClick, night, paused, ride }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const seconds = useWorldMotion(paused);
  const stages = useConstruction(state.plots, ready);
  const plots = landPlots(state, new Set(Object.entries(stages).filter(([, s]) => s === "building").map(([id]) => Number(id))));
  const active = plots.find(plot => plot.id === (hover ?? selected));
  const trees: GridPoint[] = [{row:0,col:0},{row:0,col:5},{row:0,col:8},{row:0,col:11},{row:11,col:2},{row:11,col:5},{row:11,col:8},{row:11,col:11},{row:5,col:0},{row:8,col:13}];
  return <div className={styles.world} data-world data-night={night} data-paused={paused} style={{ width: WORLD.width, height: WORLD.height }}>
    <div className={styles.layer} data-layer="1" style={{zIndex:1}} aria-hidden="true"><Terrain /></div>
    <div className={styles.layer} data-layer="2" style={{zIndex:2}} aria-hidden="true"><Roads /></div>
    <div className={styles.layer} data-layer="3" style={{zIndex:3}} aria-hidden="true">
      {active && <div className={styles.wireframe} style={anchorStyle(active)}><svg viewBox="-105 -53 210 106"><path d="M0 -48L98 0L0 48L-98 0Z" /></svg></div>}
    </div>
    <div className={styles.layer} data-layer="4" style={{zIndex:4}}>
      {plots.map(plot => {
        const venture = ventures.find(v => v.id === plot.buildingType);
        return <Sprite key={plot.id} point={plot}>
          <button type="button" className={styles.plot} data-plot={plot.id} data-status={plot.status}
            aria-label={`Plot ${plot.id + 1}: ${venture ? `${venture.name}, ${plot.status}, level ${plot.level}` : "empty, select to build"}`}
            aria-pressed={selected === plot.id} onPointerEnter={() => setHover(plot.id)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(plot.id)} onBlur={() => setHover(null)} onClick={() => onTileClick(plot.row, plot.col)}>
            <svg className={styles.foundation} viewBox="-105 -53 210 116" aria-hidden="true"><path d="M-98 0L0 48L98 0V9L0 57L-98 9Z" fill="#b3a38b"/><path d="M0 -48L98 0L0 48L-98 0Z" fill={venture ? "#ded9bf" : "#a9c88e"} stroke="#dce9bb" strokeWidth="2" /></svg>
            {plot.status === "building" ? <Scaffold /> : venture ? <svg className={`${styles.building} crisp-pixels`} viewBox="-110 -180 220 250" aria-hidden="true"><Building kind={venture.id} level={plot.level} color={venture.color} name={venture.name} night={night}/></svg> : <span className={styles.emptyMark} aria-hidden="true">＋</span>}
            <span className={styles.label}>{plot.status === "building" ? "Under construction…" : venture ? `${venture.name} · ₦${Math.round(plot.revenue / 1000)}k/wk` : `Plot ${plot.id + 1} · select to build`}</span>
          </button>
        </Sprite>;
      })}
      {[2, 5, 8, 11].map((col, id) => <Sprite key={`civic-${id}`} point={{row:0, col}}>
        <svg className={styles.civic} viewBox="-110 -180 220 250" aria-hidden="true"><Building kind={id % 2 ? "agency" : "solar"} level={id % 2 ? 3 : 2} color={["#739bbb", "#cba65e", "#76ad99", "#a596c2"][id]} name={id % 2 ? "JKTL TOWER" : "CIVIC CENTRE"} night={night}/></svg>
      </Sprite>)}
      {trees.map((point, id) => <Sprite key={`tree-${id}`} point={point}><svg className={styles.tree} viewBox="-25 -50 50 65" aria-hidden="true"><Tree x={0} y={0}/></svg></Sprite>)}
      {Array.from({length:6}, (_, id) => {
        const point = travel({row:0.5 + (id % 3) * 3,col:0}, {row:0.5 + (id % 3) * 3,col:13}, seconds / (18 + id * 3) + id / 6);
        return <Sprite key={`car-${id}`} point={point}><svg className={styles.car} viewBox="-50 -28 100 56" aria-hidden="true"><g transform="matrix(.9 .45 -.9 .45 0 0)"><Car kind={id === 0 ? ride : id % 2 ? "lamborghini" : "cybertruck"} paint={["#232e40","#edc252","#e1e9ec"][id%3]}/></g></svg></Sprite>;
      })}
      {plots.filter(p => p.status === "active").map(plot => {
        const point = travel({row:plot.row + 1.1,col:plot.col - 0.65}, {row:plot.row + 0.3,col:plot.col + 0.2}, (seconds / 9 + plot.id / 5) % 2 > 1 ? 1 - ((seconds / 9 + plot.id / 5) % 1) : (seconds / 9 + plot.id / 5) % 1, false);
        return <Sprite key={`person-${plot.id}`} point={point}><svg className={styles.person} viewBox="-10 -18 20 30" aria-hidden="true"><Person shirt={["#f0b34f","#67bbbf","#cd7ea4"][plot.id%3]}/></svg></Sprite>;
      })}
      <Sprite point={{row:10.5,col:9}}><div className={styles.citySign}>{state.city}<small>YOUR NEXT CHAPTER STARTS HERE</small></div></Sprite>
    </div>
    <div className={styles.layer} data-layer="5" style={{zIndex:5}} aria-hidden="true">
      {plots.filter(p => stages[p.id] === "ready" && p.status === "active").map(plot => <div key={plot.id} className={styles.fx} style={anchorStyle(plot)}>✦ Open for business</div>)}
    </div>
  </div>;
}
