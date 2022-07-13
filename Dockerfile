# Install dependencies only when needed
FROM node:16-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./ 
#RUN npm i -g npm@latest
RUN npm install next@canary
RUN npm ci

# Rebuild the source code only when needed
FROM node:16-alpine AS builder

ARG API_URL
ENV NEXT_PUBLIC_API_URL=$API_URL
ARG USDT_CONTRACT_ID
ENV NEXT_PUBLIC_USDT_CONTRACT_ID=$USDT_CONTRACT_ID
ARG CONTRACT_ID
ENV NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
ARG INFURA_KEY
ENV NEXT_PUBLIC_INFURA_KEY=$INFURA_KEY
ARG NETWOKR
ENV NEXT_PUBLIC_NETWOKR=$NETWOKR
ENV CI=true


WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN env && npm run build

# Production image, copy all the files and run next
FROM node:16-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system -h /home/nextjs --uid 1001 nextjs
RUN mkdir /static-data && chown nextjs:nodejs /static-data
ENV HOME=/home/nextjs

# You only need to copy next.config.js if you are NOT using the default configuration
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./

# Automatically leverage output traces to reduce image size 
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY ./entrypoint.sh ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["./entrypoint.sh"]
