FROM node:24-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm i


COPY . .

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

RUN npm prune --production

USER node

EXPOSE 4000


CMD ["node", "dist/main"]