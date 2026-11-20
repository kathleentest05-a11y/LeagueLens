# Web image. Build context is the repo root (workspace-aware, TDD 11.2).
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY tsconfig.base.json codegen.yml ./
COPY packages/shared packages/shared
COPY backend/src/api/schema.graphql backend/src/api/schema.graphql
COPY frontend frontend
ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
ENV NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL
RUN npm run codegen && npm run build -w @leaguelens/shared && npm run build -w @leaguelens/frontend
RUN npm prune --omit=dev

FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/next.config.mjs ./frontend/next.config.mjs
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@leaguelens/frontend"]
