"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, type Group, type InstancedMesh } from "three";
import { InstancedBoxes } from "@/components/tycoon/three/InstancedBoxes";
import type { BoxPart } from "@/components/tycoon/three/scene-model";
import { chaseWave, type RunState } from "@/lib/runner";

type CostumePart = BoxPart & {
  joint?: "leftLeg" | "rightLeg" | "leftArm" | "rightArm";
  fringe?: number;
};
/** Original festival-inspired costume, built from reusable low-poly geometry. */
function costume(): CostumePart[] {
  const parts: CostumePart[] = [];
  const add = (
    position: BoxPart["position"],
    size: BoxPart["size"],
    color: string,
    extra: Partial<CostumePart> = {},
  ) => parts.push({ position, size, color, ...extra });
  // Layered raffia robe, red shoulders and a navy/gold collar.
  add([0, 1.01, 0], [0.72, 0.72, 0.42], "#b52f38");
  add([0, 0.69, 0], [0.87, 0.38, 0.56], "#c59a50");
  add([0, 1.35, 0], [0.79, 0.16, 0.51], "#172e4b");
  add([0, 1.28, 0.28], [0.45, 0.12, 0.035], "#f5ca5d");
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 14; i++) {
      const angle = (i * Math.PI * 2) / 14,
        radius = ring === 0 ? 0.46 : 0.38;
      add(
        [
          Math.sin(angle) * radius,
          0.47 + ring * 0.39,
          Math.cos(angle) * radius,
        ],
        [0.1, 0.57, 0.09],
        ["#f1d58a", "#d3a45b", "#b78240", "#e7bd72"][i % 4],
        { rotation: angle, fringe: i + ring * 14 },
      );
    }
  // Colourful cloth panels remain visible from a trailing camera.
  for (let i = 0; i < 5; i++)
    add(
      [-0.28 + i * 0.14, 0.98, 0.239],
      [0.11, 0.57, 0.035],
      ["#e9bd47", "#207e6e", "#f6e9bf", "#207e6e", "#e9bd47"][i],
    );
  // Broad wooden mask: cream face, dark eye cutouts, raised nose and red markings.
  add([0, 1.7, 0], [0.59, 0.66, 0.39], "#743f2d");
  add([0, 1.72, 0.22], [0.49, 0.55, 0.09], "#f1dfac");
  add([-0.13, 1.8, 0.278], [0.13, 0.1, 0.027], "#17232d");
  add([0.13, 1.8, 0.278], [0.13, 0.1, 0.027], "#17232d");
  add([0, 1.67, 0.3], [0.09, 0.21, 0.1], "#9f6339");
  add([0, 1.5, 0.28], [0.2, 0.07, 0.03], "#9f2832");
  for (const side of [-1, 1]) {
    add([side * 0.19, 1.62, 0.28], [0.055, 0.18, 0.03], "#b72e37");
    add([side * 0.31, 1.74, 0], [0.075, 0.39, 0.43], "#e2b54b");
    add([side * 0.43, 1.2, 0], [0.25, 0.27, 0.32], "#d7ad60");
  }
  // Tall festive crest and striped back panel, readable even when turning.
  for (let i = -2; i <= 2; i++)
    add(
      [i * 0.115, 2.06 + (0.22 - Math.abs(i) * 0.07), 0],
      [0.09, 0.34, 0.16],
      i % 2 === 0 ? "#b72e37" : "#f2ca5d",
    );
  add([0, 1.75, -0.23], [0.14, 0.5, 0.035], "#f2ca5d");
  for (const side of [-1, 1]) {
    const arm = side < 0 ? "leftArm" : "rightArm",
      leg = side < 0 ? "leftLeg" : "rightLeg";
    add([side * 0.5, 0.96, 0], [0.18, 0.48, 0.2], "#b52f38", { joint: arm });
    add([side * 0.5, 0.69, 0], [0.19, 0.15, 0.21], "#d6b474", { joint: arm });
    add([side * 0.2, 0.34, 0], [0.2, 0.47, 0.22], "#803a36", { joint: leg });
    add([side * 0.2, 0.075, -0.07], [0.24, 0.15, 0.38], "#e8c585", {
      joint: leg,
    });
  }
  return parts;
}
export function MasqueradeChaser({
  read,
  reduced,
}: {
  read: () => RunState;
  reduced: boolean;
}) {
  const root = useRef<Group>(null),
    mesh = useRef<InstancedMesh>(null),
    seed = useRef<number | null>(null);
  const parts = useMemo(() => costume(), []),
    object = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    const run = read();
    if (!root.current || !mesh.current || run.phase === "paused") return;
    const x =
      run.lane * 1.33 + (run.lane === 0 ? 0.72 : -Math.sign(run.lane) * 0.42);
    const chase = chaseWave(run),
      caught = chase.phase === "caught";
    root.current.visible = chase.presence > 0.005;
    root.current.scale.setScalar(chase.presence);
    if (seed.current !== run.seed || run.phase === "ready") {
      seed.current = run.seed;
      root.current.position.set(0.72, 0, 4.8);
    }
    if (caught) {
      root.current.position.x = run.lane * 1.33 + 0.43;
      root.current.position.z = 0.52;
    } else if (chase.phase === "chasing") {
      const follow = 1 - Math.exp(-6 * Math.min(delta, 0.06));
      root.current.position.x += (x - root.current.position.x) * follow;
      root.current.position.z =
        chase.gap + (reduced ? 0 : Math.sin(run.seconds * 3) * 0.06);
    } else {
      root.current.position.z = Math.min(6, chase.gap);
    }
    const running = run.phase === "running" && chase.phase === "chasing",
      stride = running ? Math.sin(run.distance * 1.5 - 1.4) * 0.65 : 0;
    root.current.position.y =
      running && !reduced ? Math.abs(Math.sin(run.seconds * 14)) * 0.055 : 0;
    root.current.rotation.y =
      running && !reduced ? Math.sin(run.seconds * 7) * 0.055 : 0;
    parts.forEach((part, index) => {
      const px = part.position[0];
      let [, py, pz] = part.position,
        angle = 0;
      if (part.joint) {
        angle =
          (part.joint === "leftLeg" || part.joint === "rightArm" ? 1 : -1) *
          stride;
        const pivot = part.joint.endsWith("Leg") ? 0.57 : 1.21,
          dy = py - pivot;
        py = pivot + dy * Math.cos(angle) - pz * Math.sin(angle);
        pz = dy * Math.sin(angle) + pz * Math.cos(angle);
      }
      const sway =
        part.fringe !== undefined && running && !reduced
          ? Math.sin(run.seconds * 14 + part.fringe * 0.6) * 0.11
          : 0;
      object.position.set(px, py, pz);
      object.scale.set(...part.size);
      object.rotation.set(angle + sway, part.rotation || 0, 0);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={root} position={[0.72, 0, 4.8]} name="masquerade-chaser">
      <InstancedBoxes parts={parts} meshRef={mesh} cull={false} />
    </group>
  );
}
