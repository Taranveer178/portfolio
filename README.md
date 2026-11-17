# Taranveer Singh — Portfolio (ShareBills Design System)

Redesigned portfolio website matching the exact aesthetic, palette, liquid glass styling, and 3D interactive carousel of ShareBills (sharebills.in).

## Quickstart



Build for production:

## Blog publishing

The public blog is available at `/blog`; individual posts use `/blog/:slug`, and the editor is at `/add-blog`.
Blog posts use Supabase Postgres, Supabase Auth, and the `blog-covers` Storage bucket. RLS policies make posts public to read while restricting publishing and uploads to an explicitly authorized admin user.
The editor supports images between text blocks and embedded YouTube/Vimeo videos; video files are not uploaded to storage. You can also switch to HTML source mode for an article, with a sanitized preview. Scripts, unsafe markup, and embeds other than YouTube/Vimeo are removed before the article is saved or displayed. Switching modes preserves both drafts, and only the selected mode is published.

### Configure Supabase

1. Create a Supabase Free project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Configure the same values in the production frontend build environment.
3. Run [`supabase/migrations/20261117203000_create_blog.sql`](./supabase/migrations/20261117203000_create_blog.sql) in the Supabase SQL Editor. It creates the posts table, public cover-image bucket, and row-level security policies.
4. Create an admin user under **Authentication → Users**. Copy that user's UUID and add it to the allowlist in the SQL Editor:

   ```sql
   insert into public.blog_admins (user_id) values ('ADMIN_USER_UUID');
   ```

5. Restart local Vite or redeploy the site. Sign in at `/add-blog` with that Supabase user's email and password.

The Supabase anon/publishable key is intended for browser use; RLS is what protects writes. Never put a Supabase service-role key in the frontend or commit `.env.local`. Supabase Free currently includes 500 MB database, 1 GB file storage, and 5 GB egress; inactive free projects may pause after one week. Review [current Supabase limits](https://supabase.com/pricing).

If the app reports that `public.blog_posts` is missing, run the migration in step 3. If the table already exists, refresh the Data API schema cache in Supabase or run `NOTIFY pgrst, 'reload schema';` in the SQL Editor. Restart Vite after changing `.env` values.

