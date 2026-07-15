import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manufacturing/inventory/movements/stream
 * Establishes a Server-Sent Events (SSE) connection that polls Directus for updates
 * and streams new inventory movements to the client dashboard in real-time.
 */
export async function GET(request: Request) {
    let isClosed = false;
    let interval: NodeJS.Timeout | undefined;

    const responseStream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            
            // 1. Send initial connection confirmation
            try {
                controller.enqueue(
                    encoder.encode(
                        `event: initial\ndata: ${JSON.stringify({
                            message: "Connection established",
                            timestamp: new Date().toISOString()
                        })}\n\n`
                    )
                );
            } catch {
                isClosed = true;
                return;
            }

            let lastSeenId = 0;

            // 2. Fetch the most recent movement_id to seed the cursor
            try {
                const seedRes = await fetch(
                    `${DIRECTUS_URL}/items/inventory_movements?limit=1&sort=-movement_id&fields=movement_id`,
                    { headers, cache: "no-store" }
                );
                if (seedRes.ok) {
                    const seedJson = await seedRes.json();
                    if (seedJson.data && seedJson.data.length > 0) {
                        lastSeenId = Number(seedJson.data[0].movement_id) || 0;
                    }
                }
            } catch (err) {
                console.error("[Inventory Movements Stream] Failed to seed lastSeenId:", err);
            }

            // 3. Establish periodic polling check (every 3 seconds) for new entries
            interval = setInterval(async () => {
                if (isClosed) {
                    if (interval) clearInterval(interval);
                    return;
                }
                try {
                    const pollRes = await fetch(
                        `${DIRECTUS_URL}/items/inventory_movements?filter[movement_id][_gt]=${lastSeenId}&sort=movement_id&limit=100`,
                        { headers, cache: "no-store" }
                    );

                    if (isClosed) {
                        if (interval) clearInterval(interval);
                        return;
                    }

                    if (pollRes.ok) {
                        const pollJson = await pollRes.json();
                        const items = pollJson.data || [];

                        for (const item of items) {
                            if (isClosed) break;
                            try {
                                controller.enqueue(
                                    encoder.encode(`event: movement\ndata: ${JSON.stringify(item)}\n\n`)
                                );
                            } catch {
                                isClosed = true;
                                if (interval) clearInterval(interval);
                                break;
                            }
                            lastSeenId = Math.max(lastSeenId, Number(item.movement_id) || 0);
                        }
                    }
                } catch (err) {
                    if (!isClosed) {
                        console.error("[Inventory Movements Stream] Error during poll:", err);
                    }
                }
            }, 3000);

            // 4. Handle client disconnection cleanup
            request.signal.addEventListener("abort", () => {
                isClosed = true;
                if (interval) clearInterval(interval);
                try {
                    controller.close();
                } catch {
                    // Ignore already closed errors
                }
            });
        },
        cancel() {
            isClosed = true;
            if (interval) clearInterval(interval);
        }
    });

    return new Response(responseStream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive"
        }
    });
}
