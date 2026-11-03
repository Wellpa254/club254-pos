# Fresh backend + free hosting (Supabase + Cloudflare Workers)

1. Supabase: create a new project. SQL Editor -> paste fresh-setup.sql -> Run.
   Last query must return has_owner = false.
2. Supabase > Authentication > Providers > Email: turn "Confirm email" off while setting up.
3. Copy .env.example to .env and fill the Supabase URL, publishable key and service-role key.
4. Build + deploy from your machine:
     bun install
     NITRO_PRESET=cloudflare_module bun run build
     bunx wrangler login
     bunx wrangler deploy
     bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
     bunx wrangler secret put SUPABASE_URL
     bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY
5. Open the *.workers.dev URL -> "Set up your club" -> the first signup becomes owner.
6. Optional: bunx wrangler secret put OPENAI_API_KEY (invoice scanning).
