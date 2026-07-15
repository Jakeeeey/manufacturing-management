import { GET as legacyGet, POST as legacyPost } from "../procurement/qa-receiving/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    return legacyGet(request);
}

export async function POST(request: Request) {
    return legacyPost(request);
}
