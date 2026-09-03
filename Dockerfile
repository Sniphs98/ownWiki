FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# SvelteKit statically imports server modules during `vite build` to analyse
# routes; these placeholders satisfy that import-time env validation and are
# never baked into the output — the runtime stage below reads real values
# from the container environment instead.
ENV DATABASE_DIALECT=sqlite
ENV DATABASE_URL=/tmp/build.db
ENV BETTER_AUTH_SECRET=build-time-placeholder-0000000000000000
ENV ORIGIN=http://localhost:3000
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
