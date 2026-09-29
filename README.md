# TEGAT Server

Central API for the TEGAT platform. One server, three surfaces:

- **Drivers Vault** - the driver app (`../drivers-vault`)
- **Client** - the app people hire drivers from
- **Admin** - verification queue, moderation, payouts, training content

## Running locally

```bash
npm install
cp .env.example .env      # fill it in
npx prisma migrate dev
npm run dev
```

Requires Postgres and Redis. Redis backs the BullMQ email queue and the
scheduled jobs; the server starts without it but will not send email.
