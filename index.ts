import Bun from "bun";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost"];

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "";

const server = Bun.serve({
    async fetch(req) {
        const origin = req.headers.get("origin");
        const referer = req.headers.get("referer");

        let isAllowed = false;

        if (origin && ALLOWED_ORIGINS.includes(origin)) {
            isAllowed = true;
        } else if (referer) {
            try {
                const refererUrl = new URL(referer);
                if (ALLOWED_ORIGINS.includes(refererUrl.origin)) {
                    isAllowed = true;
                }
            } catch {
                isAllowed = false;
            }
        } else if (!origin && !referer) {
            isAllowed = true;
        }

        if (!isAllowed && !ALLOWED_ORIGINS.includes("*")) {
            return new Response("Forbidden: Unauthorized Domain", {
                status: 403,
            });
        }

        const url = new URL(req.url);
        const encodedUrl = url.searchParams.get("encodedUrl");
        const imageUrl = encodedUrl
            ? atob(encodedUrl)
            : url.searchParams.get("url");

        const fitQuery = url.searchParams.get("fit");
        const fit =
            fitQuery === "fill" || fitQuery === "inside" ? fitQuery : "inside";

        const quality = Number(url.searchParams.get("quality")) || 100;

        if (!imageUrl) return new Response("Missing URL", { status: 400 });

        const forwardHeaders = new Headers();

        if (url.searchParams.has("x-headers")) {
            try {
                const customHeaders = JSON.parse(
                    decodeURIComponent(
                        url.searchParams.get("x-headers") ?? "{}",
                    ),
                );

                for (const [key, value] of Object.entries(customHeaders)) {
                    forwardHeaders.set(key, String(value));
                }
            } catch (e) {
                console.error("Failed to parse x-headers:", e);
            }
        }

        let arrayBuffer: ArrayBuffer;

        if (SCRAPER_API_URL) {
            const scraperUrl = `${SCRAPER_API_URL}/api/download?url=${encodeURIComponent(imageUrl)}`;
            const imageRes = await fetch(scraperUrl);

            if (!imageRes.ok) {
                console.error(
                    `[proxy] Scraper failed (${imageRes.status}): ${imageUrl}`,
                );
                return new Response("Failed to fetch image", { status: 502 });
            }

            arrayBuffer = await imageRes.arrayBuffer();
        } else {
            const imageRes = await fetch(imageUrl, {
                method: "GET",
                headers: forwardHeaders,
            });

            if (!imageRes.ok) {
                console.error(
                    `[proxy] Fetch failed (${imageRes.status}): ${imageUrl}`,
                );
                return new Response("Failed to fetch image", { status: 500 });
            }

            arrayBuffer = await imageRes.arrayBuffer();
        }

        let imagePipeline = new Bun.Image(arrayBuffer);

        const width = Number(url.searchParams.get("w")) || null;
        const height = Number(url.searchParams.get("h")) || null;

        if (typeof width === "number" && typeof height === "number") {
            imagePipeline = imagePipeline.resize(width, height, { fit });
        }

        const processed = imagePipeline.webp({ quality });
        const buffer = await processed.bytes();

        return new Response(buffer as BodyInit, {
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": origin || ALLOWED_ORIGINS[0],
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Headers",
                "Access-Control-Max-Age": "86400",
            },
        });
    },

    port: process.env.PORT || 3000,
});

console.log(`Server running at ${server.url}`);
