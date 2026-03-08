FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm i


COPY . .

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

RUN npm prune --production

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/src/main"]