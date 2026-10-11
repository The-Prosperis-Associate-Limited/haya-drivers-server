# TEGAT Server

Central API for the TEGAT platform. One server, three surfaces:

- **Haya Drivers** - the driver app (`../drivers-vault`)
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

## Create test drivers

The repository includes ten complete, verified driver profiles. Set a shared
password in `.env`, then run the idempotent seed command:

```bash
SEED_DRIVER_PASSWORD='LocalDrivers123!' npm run seed:drivers
```

The script prints each driver's email and the shared password. Running it again
does not duplicate drivers. To email credentials through Resend instead, set
`SEED_DRIVER_EMAIL_CREDENTIALS=true` and configure `RESEND_API_KEY`.

Test-driver seeding is blocked when `NODE_ENV=production` unless
`ALLOW_TEST_DRIVER_SEED=true` is deliberately set.

## Test with containers

Install Docker Desktop (or Docker Engine with the Compose plugin), then run:

```bash
docker compose up --build -d
docker compose ps
curl http://localhost:8080/api
```

Create the ten test drivers inside the API container:

```bash
docker compose run --rm api npm run seed:drivers
```

Confirm the records directly in the containerized Postgres database:

```bash
docker compose exec postgres psql -U drivers_vault -d drivers_vault \
  -c "SELECT email, first_name, last_name FROM \"User\" WHERE role = 'DRIVER' ORDER BY email;"
```

Useful container commands:

```bash
docker compose logs -f api
docker compose down
docker compose down -v  # also deletes the local test database
```

The last command is destructive; use it only when you want a completely fresh
container database.
