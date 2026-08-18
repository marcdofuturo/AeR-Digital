FROM node:22-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 3001

USER node
CMD ["pnpm", "--filter", "@ar/worker", "exec", "tsx", "src/index.ts"]
