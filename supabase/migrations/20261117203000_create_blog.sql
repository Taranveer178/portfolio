CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  excerpt TEXT NOT NULL CHECK (char_length(excerpt) BETWEEN 20 AND 280),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 20 AND 50000),
  category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 32),
  cover_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX blog_posts_created_at_idx ON public.blog_posts (created_at DESC);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.blog_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

ALTER TABLE public.blog_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read blog posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Blog admins can publish posts"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Blog admins can read their own role"
  ON public.blog_admins FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-covers',
  'blog-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

CREATE POLICY "Public can read blog cover images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'blog-covers');

CREATE POLICY "Blog admins can upload cover images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-covers'
    AND EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Blog admins can clean up cover images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
