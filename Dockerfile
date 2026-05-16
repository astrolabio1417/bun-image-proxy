FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json .
COPY bun.lock .
COPY . .

RUN bun install && bun run build

ENTRYPOINT [ "bun", "run", "start" ]