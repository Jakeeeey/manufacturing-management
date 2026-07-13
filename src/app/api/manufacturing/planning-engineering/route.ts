import { handleGET } from "./handlers/get";
import { handlePOST } from "./handlers/post";
import { handlePATCH } from "./handlers/patch";
import { handleDELETE } from "./handlers/delete";

export async function GET(request: Request) {
    return handleGET(request);
}

export async function POST(request: Request) {
    return handlePOST(request);
}

export async function PATCH(request: Request) {
    return handlePATCH(request);
}

export async function DELETE(request: Request) {
    return handleDELETE(request);
}
