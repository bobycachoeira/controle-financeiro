FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/notifier/package.json apps/notifier/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/src packages/shared/src
COPY tsconfig.base.json ./
COPY apps/notifier apps/notifier

RUN pnpm install --frozen-lockfile --filter @cf/notifier...

CMD ["pnpm", "--filter", "@cf/notifier", "start"]
