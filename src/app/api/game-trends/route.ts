import {nigeriaTrends} from "@/lib/google-trends";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json({trends:await nigeriaTrends(),source:"Google Trends",region:"NG"},{headers:{"Cache-Control":"public, s-maxage=1800, stale-while-revalidate=3600"}});}catch{return Response.json({error:"Trending searches are temporarily unavailable."},{status:503});}}
