# Backend image (API + worker; Compose picks the command). Build context is the repo root.
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY tsconfig.base.json codegen.yml ./
COPY packages/shared packages/shared
COPY backend backend
RUN npm run codegen && npm run build -w @leaguelens/shared && npm run build -w @leaguelens/backend
RUN npm prune --omit=dev

FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
USER node
EXPOSE 4000
CMD ["npm", "run", "start:api", "-w", "@leaguelens/backend"]
