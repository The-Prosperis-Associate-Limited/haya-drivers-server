FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma generation reads the datasource URL but does not connect to it.
RUN DATABASE_URL=postgresql://drivers_vault:drivers_vault@localhost:5432/drivers_vault npm run db:generate \
  && npm run build

EXPOSE 8080

CMD ["npm", "start"]
