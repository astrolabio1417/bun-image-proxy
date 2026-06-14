# Bun Image Proxy

## Features

- **Dynamic Resizing:** Supports explicit width (`w`) and height (`h`) changes, or proportional auto-scaling if only one dimension is provided.
- **Format Optimization:** Automatically encodes and delivers images in WebP format.
- **Header Forwarding:** Accepts a URL-encoded JSON object of custom headers (`x-headers`) to pass along to strict destination servers (e.g., Referer, User-Agent, Authorization).
- **Optional scraper-api upstream:** Can call a scraper-api service first, then fall back to direct fetch if the upstream is unavailable.
- **Security & Hotlink Protection:** Validates incoming requests against an environment-defined whitelist of `Origin` and `Referer` headers to prevent unauthorized third-party bandwidth usage.

---

## Environment Variables

Configure these variables inside your `.env` file or pass them directly during container execution.

| Variable          | Description                                                             | Default                 | Example                                  |
| :---------------- | :---------------------------------------------------------------------- | :---------------------- | :--------------------------------------- |
| `PORT`            | The port the Bun server listens on inside the container.                | `3001`                  | `3000`                                   |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed domains permitted to request resources. | `http://localhost:3000` | `http://localhost,http://localhost:3001` |
| `SCRAPER_API_URL` | Base URL of the scraper-api service used as an upstream fetcher.        | _unset_                 | `http://localhost:5001`                  |

---

## API Query Parameters

Requests are made to the base URL using the following query string parameters:

| Parameter    | Type                 | Required    | Description                                                                        |
| :----------- | :------------------- | :---------- | :--------------------------------------------------------------------------------- |
| `url`        | `string`             | Conditional | The direct, unencoded target image URL to fetch and proxy.                         |
| `encodedUrl` | `string`             | Conditional | Base64 encoded target image URL (takes priority over `url` if present).            |
| `w`          | `number`             | Optional    | Target output width in pixels.                                                     |
| `h`          | `number`             | Optional    | Target output height in pixels.                                                    |
| `fit`        | `"inside" \| "fill"` | Optional    | Resizing logic. Defaults to `"inside"`.                                            |
| `quality`    | `number`             | Optional    | WebP compression quality level (1-100). Defaults to `100`.                         |
| `x-headers`  | `string`             | Optional    | URL-encoded JSON string representing headers to forward to the destination server. |

### scraper-api Integration

If `SCRAPER_API_URL` is set, the proxy will first call `POST /api/fetch` on that service with a JSON body like:

```json
{
	"url": "https://example.com/photo.jpg",
	"headers": {
		"Referer": "https://example.com"
	}
}
```

The Bun proxy will use the upstream response if it can extract image bytes from one of these shapes:

- Raw binary response with an image content type
- JSON containing `body_base64`, `data_base64`, or `image_base64`
- JSON containing a string `data` field plus an image `content_type`

If none of those are present, it falls back to the direct fetch path that already exists.

### Example Request Syntax

```
GET http://localhost:3000/?w=400&h=400&fit=inside&quality=80&url=https://example.com/photo.jpg
```

---

## Local Development

### Installation

Ensure you have Bun v1.2.3+ installed locally.

```
bun install
```

### Running the Development Server

```
bun run dev
```

### Running with Docker Compose

This repository includes a compose file that runs the Bun proxy alongside the scraper-api image from GHCR.

```
docker compose up --build
```

The proxy will be available on `http://localhost:3001` and scraper-api on `http://localhost:5001`.

The compose setup sets `SCRAPER_API_URL=http://scraper-api:5001` so the proxy can reach the upstream service by container name.
It also sets `ALLOWED_ORIGINS=*` so you can test the proxy directly from the browser or with `wget` without an `Origin` or `Referer` header.

---

## Production Deployment with Docker

### Build the Image

```
docker build -t img-proxy .
```

### Run the Container

Run the container locally while loading your environment configuration variables:

```
docker run -p 3000:3000 --env-file .env img-proxy
```
