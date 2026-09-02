# End-to-end tests

These drive a real browser against a running site, so they need a database with
live quotes:

```bash
docker run -d --name pakremits-pg -e POSTGRES_PASSWORD=pakremits -e POSTGRES_DB=pakremits \
  -p 55432:5432 postgres:16-alpine
npm run db:migrate && npm run seed && npm run refresh
npm run e2e
```

`npm run refresh` takes about five minutes — it walks every corridor, method and
amount with polite per-host throttling.

The suite asserts on *behaviour*, not on specific rates. Which provider wins
changes hourly and a test pinned to "Remitly is first" would fail on a
promotional rate expiring. What it does assert is that the table is ordered by
rupees received, that the gold highlight tracks the most rupees regardless of
the visible sort, and that the ranking cannot be moved by sponsorship.
