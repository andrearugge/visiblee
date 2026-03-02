FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm install

CMD ["sh", "-c", "npm run db:generate --workspace=apps/web && npm run worker --workspace=apps/web"]
