# Taranveer Singh — Portfolio (ShareBills Design System)

Redesigned portfolio website matching the exact aesthetic, palette, liquid glass styling, and 3D interactive carousel of ShareBills (sharebills.in).

## Quickstart



Build for production:

## Blog publishing

The public blog is available at `/blog`; individual posts use `/blog/:slug`, and the protected editor is at `/add-blog`.
Publishing is handled by the Cloudflare Worker in `worker/`, with Cloudflare D1 for posts and R2 for cover images.
The admin password is a Worker secret and is never included in the frontend bundle or stored in the browser.

### Configure and deploy the API

1. Install Wrangler or use it through `npx wrangler`.
2. From `worker/`, create the D1 database (`npx wrangler d1 create taranveer-blog`) and R2 bucket (`npx wrangler r2 bucket create taranveer-blog-images`).
3. Replace `database_id` in `worker/wrangler.toml` with the ID returned by Cloudflare.
4. Apply the migration and set the publishing password as a secret:
   - `npx wrangler d1 migrations apply taranveer-blog --remote`
   - `npx wrangler secret put BLOG_ADMIN_PASSWORD` (enter the value only at Wrangler's prompt; do not put it in a file or command)
5. Set `ALLOWED_ORIGINS` in `worker/wrangler.toml` to the exact origins serving the site, then deploy with `npx wrangler deploy`.
6. Set `VITE_BLOG_API_URL` to the deployed Worker URL ending in `/api` in the frontend build environment. For local development, copy `.env.example` to `.env.local` and use the Worker API URL.

The Worker limits failed password attempts, validates post and image sizes, and accepts only configured browser origins. Do not expose the admin password as a `VITE_` variable.

