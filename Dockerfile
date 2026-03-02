FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm install && npm run db:generate --workspace=apps/web

CMD ["npm", "run", "worker", "--workspace=apps/web"]
