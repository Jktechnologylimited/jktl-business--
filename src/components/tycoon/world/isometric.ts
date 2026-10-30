import type { CSSProperties } from "react";
import { ventures, type TycoonState, type VentureId } from "@/lib/tycoon";

export const TILE = { width: 128, height: 64 } as const;
export const WORLD = { width: 1820, height: 1110, originX: 900, originY: 155 } as const;
export type GridPoint = { row: number; col: number };
export type LandPlot = GridPoint & {
  id: number;
  status: "empty" | "building" | "active";
  buildingType?: VentureId;
  level: number;
  revenue: number;
};
/** Anchor is the centre of the diamond. Col moves down-right; row down-left. */
export function gridToScreen({ row, col }: GridPoint) {
  return {
    x: WORLD.originX + (col - row) * TILE.width / 2,
    y: WORLD.originY + (col + row) * TILE.height / 2,
  };
}
export function screenToGrid(x: number, y: number): GridPoint {
  const horizontal = (x - WORLD.originX) / (TILE.width / 2);
  const vertical = (y - WORLD.originY) / (TILE.height / 2);
  return { row: (vertical - horizontal) / 2, col: (vertical + horizontal) / 2 };
}
/** World coordinates, never projected screen X. Equal depths retain stable DOM order. */
export const depthIndex = ({ row, col }: GridPoint) => Math.round((row + col) * 1000);
export function anchorStyle(point: GridPoint): CSSProperties {
  const position = gridToScreen(point);
  return { left: position.x, top: position.y, zIndex: depthIndex(point) };
}
export function landPlots(state: TycoonState, constructing: ReadonlySet<number> = new Set()): LandPlot[] {
  return state.plots.map((plot, id) => {
    const venture = ventures.find(v => v.id === plot?.kind);
    return {
      id, row: 2 + Math.floor(id / 4) * 3, col: 2 + id % 4 * 3,
      status: !plot ? "empty" : constructing.has(id) ? "building" : "active",
      buildingType: plot?.kind, level: plot?.level || 0,
      revenue: venture ? venture.income * plot!.level : 0,
    };
  });
}
/** Continuous grid interpolation keeps animated traffic in the same depth system. */
export function travel(from: GridPoint, to: GridPoint, progress: number, loop = true): GridPoint {
  const t = loop ? ((progress % 1) + 1) % 1 : Math.max(0, Math.min(1, progress));
  return { row: from.row + (to.row - from.row) * t, col: from.col + (to.col - from.col) * t };
}
