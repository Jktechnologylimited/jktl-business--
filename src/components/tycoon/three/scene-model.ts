import { ventures, type TycoonState } from "@/lib/tycoon";
import { landPlots } from "../world/isometric";
export type Vec3 = [number, number, number];
export type BoxPart = { position: Vec3; size: Vec3; color: string; plotId?: number; rotation?: number };
export type Quality = "low" | "high";
export const profiles = {
  low: { fps: 30, dpr: 1, shadows: false, cars: 4, people: 8 },
  high: { fps: 60, dpr: 1.25, shadows: true, cars: 8, people: 16 },
} as const;
export const worldPoint = (row: number, col: number): Vec3 => [col - 6.5, 0, row - 5.5];
export const TREE_POINTS = [[0,0],[0,2],[0,5],[0,8],[0,11],[0,13],[2,0],[5,0],[8,0],[11,0],[11,2],[11,5],[11,8],[11,11],[11,13],[2,13],[5,13],[8,13]];

export function terrainParts(): BoxPart[] {
  const tones = ["#9fbc7b", "#aec88a", "#acc382", "#94b474"];
  const parts: BoxPart[] = [{ position:[0,-.35,0], size:[14,.6,12], color:"#b9a580" }];
  for(let row=0;row<12;row++) for(let col=0;col<14;col++) {
    const [x,,z]=worldPoint(row,col);
    parts.push({position:[x,-.025,z],size:[.99,.06,.99],color:tones[(row*7+col*3)%4]});
  }
  for(const [row,col] of TREE_POINTS) {
    const [x,,z]=worldPoint(row,col);
    parts.push({position:[x,.25,z],size:[.12,.5,.12],color:"#8e7250"});
  }
  return parts;
}
export function roadParts(): BoxPart[] {
  const parts: BoxPart[]=[];
  for(const row of [.5,3.5,6.5,9.5]) {
    parts.push({position:[0,.025,row-5.5],size:[14,.035,.62],color:"#ded6bd"});
    parts.push({position:[0,.05,row-5.5],size:[14,.025,.45],color:"#536573"});
    for(let col=-.25;col<14;col+=.55) parts.push({position:[col-6.5,.07,row-5.5],size:[.19,.012,.025],color:"#e4d9b6"});
  }
  for(const col of [.5,3.5,6.5,9.5,12.5]) {
    parts.push({position:[col-6.5,.03,0],size:[.62,.035,12],color:"#ded6bd"});
    parts.push({position:[col-6.5,.055,0],size:[.45,.025,12],color:"#536573"});
    for(let row=-.25;row<12;row+=.55) parts.push({position:[col-6.5,.075,row-5.5],size:[.025,.012,.19],color:"#e4d9b6"});
  }
  return parts;
}
export function buildingParts(state: TycoonState, construction: ReadonlySet<number>, night: boolean): BoxPart[] {
  const parts: BoxPart[]=[];
  for(const plot of landPlots(state,construction)) {
    const [x,,z]=worldPoint(plot.row,plot.col);
    const add=(dx:number,y:number,dz:number,size:Vec3,color:string)=>parts.push({position:[x+dx,y,z+dz],size,color,plotId:plot.id});
    add(0,.13,0,[2.35,.18,2.35],plot.status==="empty" ? "#b7ce95" : "#ded7bb");
    if(plot.status==="empty") {
      add(0,.235,0,[.5,.025,.055],"#77956b");
      add(0,.235,0,[.055,.025,.5],"#77956b");
      continue;
    }
    if(plot.status==="building") {
      for(const dx of [-.8,.8]) for(const dz of [-.8,.8]) add(dx,1.1,dz,[.065,1.8,.065],"#edba52");
      for(const y of [.5,1.1,1.7]) {
        for(const dz of [-.8,.8]) add(0,y,dz,[1.65,.06,.065],"#f1cc6a");
        for(const dx of [-.8,.8]) add(dx,y,0,[.065,.06,1.65],"#f1cc6a");
      }
      add(.85,2,0,[.09,3.6,.09],"#e1aa3d");
      add(0,3.7,0,[2,.09,.09],"#f3cd65");
      continue;
    }
    const venture=ventures.find(v=>v.id===plot.buildingType)!;
    const height=1.1+plot.level*.58;
    add(0,height/2+.22,0,[1.6,height,1.55],venture.color);
    add(0,height+.28,0,[1.77,.16,1.72],"#f6e9cc");
    add(0,height+.385,0,[1.48,.065,1.43],plot.buildingType==="solar" ? "#325476" : "#819297");
    add(0,.64,.788,[.32,.85,.04],"#253b4c");
    for(let floor=0;floor<plot.level+1;floor++) for(const dx of [-.5,0,.5]) {
      const y=.72+floor*.48;
      if(dx!==0 || floor>0) add(dx,y,.791,[.28,.28,.035],night ? "#ffe6a0" : "#3c617b");
      add(.811,y,dx,[.035,.28,.28],night ? "#ffdda0" : "#365772");
    }
    if(["suya","salon","provisions"].includes(venture.id)) {
      for(let stripe=0;stripe<6;stripe++) add(-.65+stripe*.26,1.15,1,[.26,.12,.5],stripe%2 ? "#fff1d5" : "#c87653");
    }
    if(venture.id==="solar") {
      for(let panel=0;panel<3;panel++) add(-.48+panel*.48,height+.46,0,[.42,.07,1.1],"#2b5e89");
    }
    if(venture.id==="agency") add(.48,height+.72,-.4,[.055,.7,.055],"#d2d8d2");
    add(0,1.35,.805,[1.2,.2,.05],"#f4ead5");
  }
  return parts;
}
export function selectionParts(row:number,col:number): BoxPart[] {
  const [x,,z]=worldPoint(row,col);
  return [
    {position:[x-1.2,.25,z],size:[.045,.04,2.44],color:"#ffe299"},
    {position:[x+1.2,.25,z],size:[.045,.04,2.44],color:"#ffe299"},
    {position:[x,.25,z-1.2],size:[2.44,.04,.045],color:"#ffe299"},
    {position:[x,.25,z+1.2],size:[2.44,.04,.045],color:"#ffe299"},
  ];
}
