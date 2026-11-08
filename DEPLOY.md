# Blooms Members Club: fresh backend + free hosting (Supabase + Cloudflare Workers)

## One-time setup
1. Supabase: create a new project. SQL Editor -> paste fresh-setup.sql -> Run.
   The last query must return has_owner = false. Then run import-club-products.sql.
2. Supabase > Authentication > Providers > Email: turn "Confirm email" off while setting up.
3. Copy .env.example to .env and fill in the Supabase URL, publishable key and secret key.
4. Deploy from your machine:
     bun install
     NITRO_PRESET=cloudflare_module bun run build
     bunx wrangler login
     bunx wrangler deploy
     bunx wrangler secret put SUPABASE_URL
     bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
     bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   The Worker name (club-pos) comes from wrangler.jsonc. It must match the Worker name in Cloudflare.
5. Open https://club-pos.<your-subdomain>.workers.dev -> "Set up your club" -> the first signup becomes owner.
6. Optional: bunx wrangler secret put OPENAI_API_KEY (invoice scanning).

## Manual redeploy after a change
     NITRO_PRESET=cloudflare_module bun run build
     bunx wrangler deploy

## Automatic deploys (Cloudflare Workers Builds)
Cloudflare dashboard > Workers & Pages > club-pos > Settings > Builds > Connect, then pick the GitHub repo and branch main.
- Build command:   NITRO_PRESET=cloudflare_module bun run build
- Deploy command:  npx wrangler deploy        (the default)
- Build variables (Settings > Build > Build variables and secrets):
    VITE_SUPABASE_URL              = your Supabase project URL
    VITE_SUPABASE_PUBLISHABLE_KEY  = your sb_publishable_ key
    BUN_VERSION                    = 1.3.14
- Runtime secrets (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY) are NOT build variables.
  They stay saved on the Worker from step 4; builds never touch them.
After that, every `git push` to main rebuilds and redeploys the live site.
