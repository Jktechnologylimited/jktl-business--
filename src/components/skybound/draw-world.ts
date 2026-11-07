import {
  SKY_ZONES,
  skyEnemyX,
  type SkyMap,
  type SkyState,
} from "@/lib/skybound";
function rect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
) {
  c.fillStyle = colour;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function palm(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  rect(c, -4, -100, 9, 100, "#8b684c");
  for (let k = 0; k < 5; k++) {
    c.save();
    c.translate(0, -100);
    c.rotate((k - 2) * 0.62);
    rect(c, 0, -5, 48, 11, "#3e806a");
    rect(c, 33, 3, 15, 7, "#3e806a");
    c.restore();
  }
  c.restore();
}
function skyline(
  c: CanvasRenderingContext2D,
  camera: number,
  width: number,
  night: boolean,
) {
  for (let k = -1; k < Math.ceil(width / 130) + 2; k++) {
    const x = k * 130 - ((camera * 0.23) % 130),
      h = 65 + (((k + 35) * 47) % 125);
    rect(c, x, 378 - h, 85, h, night ? "#283b59" : "#88b6ad");
    rect(c, x + 9, 367 - h, 68, 11, night ? "#405475" : "#a2c6b7");
    for (let row = 0; row < Math.floor(h / 22); row++)
      for (let col = 0; col < 3; col++)
        rect(
          c,
          x + 12 + col * 22,
          388 - h + row * 22,
          10,
          9,
          night
            ? (col + row + k) % 3 === 0
              ? "#e7c885"
              : "#486079"
            : "#d6e4cc",
        );
  }
}
export function drawSky(
  c: CanvasRenderingContext2D,
  s: SkyState,
  map: SkyMap,
  width: number,
  motion: number,
) {
  const zone = SKY_ZONES[s.level],
    camera = Math.max(0, Math.min(map.width - width, s.x - width * 0.34));
  const gradient = c.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, zone.sky);
  gradient.addColorStop(1, zone.horizon);
  c.fillStyle = gradient;
  c.fillRect(0, 0, width, 540);
  c.fillStyle = zone.night ? "#f9e8b2" : "#ffedb5";
  c.beginPath();
  c.arc(width * 0.79, 105, 38, 0, Math.PI * 2);
  c.fill();
  if (zone.night)
    for (let i = 0; i < 35; i++)
      rect(
        c,
        (i * 131 + 27) % width,
        30 + ((i * 71) % 210),
        2,
        2,
        i % 2 ? "#cadbd9" : "#f3dcaa",
      );
  for (let i = -1; i < Math.ceil(width / 310) + 1; i++) {
    const x = i * 310 - ((camera * 0.1) % 310) + ((motion * 2) % 60);
    c.fillStyle = zone.night ? "#43516b66" : "#f7f2d999";
    c.beginPath();
    c.ellipse(x, 155 + (i % 3) * 31, 58, 12, 0, 0, Math.PI * 2);
    c.fill();
  }
  skyline(c, camera, width, zone.night);
  rect(c, 0, 378, width, 170, zone.water);
  for (let i = 0; i < 17; i++)
    rect(
      c,
      (i * 103 - camera * 0.4) % Math.max(width, 1),
      397 + (i % 7) * 20,
      37,
      2,
      zone.night ? "#a2b4bd33" : "#d6f1dd66",
    );
  c.save();
  c.translate(-Math.floor(camera), 0);
  // Original market stalls, canopy bunting and palms sit behind the playable terrain.
  for (let x = 160; x < map.width; x += 490) {
    palm(c, x, 460, 0.8);
    rect(c, x + 100, 375, 102, 85, zone.night ? "#46536e" : "#dfba90");
    rect(c, x + 91, 366, 120, 13, "#725454");
    for (let i = 0; i < 6; i++)
      rect(c, x + 91 + i * 20, 366, 20, 14, i % 2 ? "#c77661" : "#eaca8e");
    rect(c, x + 117, 401, 30, 59, "#506d6b");
    rect(c, x + 162, 393, 24, 25, zone.night ? "#f1d797" : "#e9e4bc");
  }
  for (const p of map.solids) {
    if (p.x + p.w < camera - 40 || p.x > camera + width + 40) continue;
    rect(c, p.x, p.y, p.w, p.h, zone.soil);
    rect(c, p.x, p.y, p.w, 8, zone.grass);
    rect(c, p.x, p.y + 8, p.w, 3, "#d3bc7977");
    if (p.h > 30) {
      for (let row = 0; row < 4; row++)
        for (let x = p.x + (row % 2) * 21; x < p.x + p.w - 20; x += 42) {
          rect(c, x, p.y + 20 + row * 24, 29, 2, "#2d354333");
          rect(c, x + 29, p.y + 15 + row * 24, 2, 15, "#2d354333");
        }
    } else {
      rect(c, p.x + 5, p.y + 14, p.w - 10, 4, "#172b3433");
      rect(c, p.x + 8, p.y + 22, 5, 7, "#7c7757");
    }
  }
  for (const x of map.checkpoints) {
    const active = s.checkpoint >= x;
    rect(c, x, 375, 5, 85, "#f1e7bc");
    c.fillStyle = active ? "#e9b84f" : "#638d8a";
    c.beginPath();
    c.moveTo(x + 5, 376);
    c.lineTo(x + 42, 387);
    c.lineTo(x + 5, 400);
    c.fill();
    if (active) {
      rect(c, x - 7, 454, 22, 6, "#d8b75c");
    }
  }
  for (const p of map.spikes) {
    for (let x = p.x; x < p.x + p.w; x += 14) {
      c.fillStyle = "#6c4564";
      c.beginPath();
      c.moveTo(x, p.y + p.h);
      c.lineTo(x + 7, p.y);
      c.lineTo(x + 14, p.y + p.h);
      c.fill();
      rect(c, x + 6, p.y + 6, 2, 7, "#d2a0a5");
    }
  }
  for (const gem of map.gems) {
    if (s.collected.includes(gem.id)) continue;
    const y = gem.y + Math.sin(motion * 3 + gem.id) * 3;
    c.save();
    c.translate(gem.x, y);
    c.rotate(Math.PI / 4);
    rect(c, -7, -7, 14, 14, "#f4cd60");
    rect(c, -4, -4, 5, 5, "#fff3b5");
    c.restore();
  }
  for (const enemy of map.enemies) {
    if (s.defeated.includes(enemy.id)) continue;
    const x = skyEnemyX(enemy, s.seconds, s.level),
      bob = Math.sin(motion * 9 + enemy.id) * 1.5;
    rect(c, x + 2, 452, 31, 8, "#182a3a22");
    rect(c, x, 438 + bob, 31, 15, "#744965");
    rect(c, x + 5, 432 + bob, 23, 10, "#af697c");
    rect(c, x + 5, 436 + bob, 6, 6, "#fff2cc");
    rect(c, x + 8, 438 + bob, 3, 3, "#273a47");
    rect(c, x + 20, 436 + bob, 6, 6, "#fff2cc");
    rect(c, x + 22, 438 + bob, 3, 3, "#273a47");
    for (let i = 0; i < 3; i++) rect(c, x + i * 12, 451, 5, 6, "#3d3a52");
  }
  // The beacon, rather than a borrowed flag or castle, marks each original level's exit.
  const gate = map.width - 100;
  rect(c, gate - 19, 361, 38, 99, "#45666a");
  rect(c, gate - 29, 351, 58, 16, "#e2be70");
  rect(c, gate - 12, 375, 24, 66, "#25484d");
  c.fillStyle = "#f7d76f";
  c.beginPath();
  c.arc(gate, 348, 15 + Math.sin(motion * 2) * 2, 0, Math.PI * 2);
  c.fill();
  rect(c, gate - 3, 332, 6, 31, "#fff2c2");
  // Kora: braid, saffron scarf and turquoise jacket. All artwork is drawn here.
  if (s.invincible === 0 || Math.floor(motion * 12) % 2 === 0) {
    c.save();
    c.translate(Math.round(s.x + 13), Math.round(s.y));
    if (s.facing < 0) c.scale(-1, 1);
    const swing = s.grounded
      ? Math.sin(motion * 16) * Math.min(4, Math.abs(s.vx) / 40)
      : 3;
    rect(c, -10, 33, 24, 5, "#102d4333");
    rect(c, -7, 22, 6, 11 + swing, "#263956");
    rect(c, 3, 22, 6, 11 - swing, "#263956");
    rect(c, -9, 31 + swing, 10, 5, "#e8c985");
    rect(c, 2, 31 - swing, 11, 5, "#e8c985");
    rect(c, -9, 10, 21, 16, "#218e8d");
    rect(c, -6, 0, 15, 13, "#9a5e42");
    rect(c, -8, -2, 19, 5, "#263143");
    rect(c, -10, 2, 5, 16, "#263143");
    rect(c, -11, 15, 5, 6, "#c8a054");
    rect(c, 5, 5, 3, 3, "#f9f1cc");
    rect(c, -10, 11, 23, 5, "#efbd59");
    rect(c, -20, 12 + Math.sin(motion * 8) * 2, 13, 5, "#efbd59");
    rect(c, -10, 17 + swing, 5, 11, "#9a5e42");
    rect(c, 11, 17 - swing, 5, 10, "#9a5e42");
    c.restore();
  }
  c.restore();
  if (s.invincible > 1.75) {
    c.fillStyle = "#f4d57c22";
    c.fillRect(0, 0, width, 540);
  }
}
