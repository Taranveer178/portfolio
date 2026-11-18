# Taranveer Singh — Portfolio (ShareBills Design System)

Redesigned portfolio website matching the exact aesthetic, palette, liquid glass styling, and 3D interactive carousel of ShareBills (sharebills.in).

## Quickstart



Build for production:

## Blog publishing

The public blog is available at `/blog`; individual posts use `/blog/:slug`, and the admin dashboard is at `/add-blog`.
Blog posts use Supabase Postgres, Supabase Auth, and the `blog-covers` Storage bucket. RLS policies make posts public to read while restricting publishing, editing, deletion, and comment moderation to an explicitly authorized admin user.
The editor supports rich text formatting, images between text blocks, and embedded YouTube/Vimeo videos. HTML source mode accepts sanitized markup and HTTPS iframe embeds, which are sandboxed when displayed. Scripts and unsafe markup are removed before content is saved or displayed. Switching modes preserves both drafts, and only the selected mode is published. Readers can submit comments; comments remain hidden until an admin approves them from `/add-blog`. Article pages include a sticky details panel and social sharing links.
The sitemap includes the homepage, blog index, and all published post URLs. `npm run build` fetches the current public post slugs from Supabase and regenerates both `public/sitemap.xml` and `dist/sitemap.xml`, so new posts and edited slugs are included in the next production build and deployment. The sitemap is a static file in this Vite deployment; publishing a post or changing its slug does not change the live sitemap until the site is rebuilt and redeployed.

### Configure Supabase

1. Create a Supabase Free project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Configure the same values in the production frontend build environment.
3. Run the SQL migrations in `supabase/migrations/` in filename order in the Supabase SQL Editor. The first migration creates the posts table, public cover-image bucket, and publishing policies. The second adds author details, admin edit/delete permissions, and moderated comments. The third adds blog SEO metadata fields.
4. Create an admin user under **Authentication → Users**. Copy that user's UUID and add it to the allowlist in the SQL Editor:

   ```sql
   insert into public.blog_admins (user_id) values ('ADMIN_USER_UUID');
   ```

5. Restart local Vite or redeploy the site. Sign in at `/add-blog` with that Supabase user's email and password.

The Supabase anon/publishable key is intended for browser use; RLS is what protects writes. Never put a Supabase service-role key in the frontend or commit `.env.local`. Supabase Free currently includes 500 MB database, 1 GB file storage, and 5 GB egress; inactive free projects may pause after one week. Review [current Supabase limits](https://supabase.com/pricing).

If the app reports that a blog table is missing, run the migrations in step 3. If the tables already exist, refresh the Data API schema cache in Supabase or run `NOTIFY pgrst, 'reload schema';` in the SQL Editor. Restart Vite after changing `.env` values.

