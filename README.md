# Pixel-Perfect Replica

POS, inventory, shifts and financial intelligence for clubs, bars and lounges.
Built with TanStack Start, React, Tailwind, Supabase and Drizzle.

## Development

```sh
bun install      # or: npm install
bun run dev      # or: npm run dev
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | client + build | Supabase connection |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server | Supabase connection for SSR / server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin client (staff creation) |
| `OPENAI_API_KEY` | server only | Invoice scanning |
| `OPENAI_INVOICE_MODEL` | server only, optional | Defaults to `gpt-4.1` |
| `CRON_SECRET` | server only, optional | Bearer secret for cron endpoints |
| `DATABASE_URL` | local, optional | Used by `drizzle-kit` for migrations |

## Build

```sh
bun run build
```

Nitro picks the deployment target automatically; set `NITRO_PRESET` to force one (e.g. `node-server`).
