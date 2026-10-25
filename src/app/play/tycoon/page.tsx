import type { Metadata } from 'next';
import { TycoonGame } from '@/components/tycoon/TycoonGame';
export const metadata:Metadata={title:'JKTL Business Tycoon | Build your Nigerian business',description:'Try a free Nigerian business simulation. Open ventures, manage play-money cash flow and build your neighbourhood. Play as a guest or use your existing JKTL account.'};
export default function Page(){return <TycoonGame/>;}
