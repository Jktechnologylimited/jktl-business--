import type { Metadata } from "next";
import { RunnerGame } from "@/components/runner/RunnerGame";
export const metadata:Metadata={title:"JKTL Street Run | Run, collect coins and earn points",description:"Play JKTL Street Run: a free 3D running game. Dodge vehicles, jump barriers, slide under signs and beat your best score."};
export default function Page(){return <RunnerGame/>;}
