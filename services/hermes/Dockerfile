FROM node:20.10-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod=false --no-frozen-lockfile

FROM node:20.10-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:20.10-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S hermes && adduser -S hermes -G hermes
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER hermes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "import('node:http').then(({request})=>request({host:'localhost',port:process.env.HERMES_PORT||8787,path:'/healthz',timeout:2000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1)).end())"
EXPOSE 8787
CMD ["node", "--enable-source-maps", "dist/index.js"]
