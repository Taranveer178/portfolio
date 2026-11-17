ALTER TABLE public.blog_posts
  ADD COLUMN author TEXT NOT NULL DEFAULT 'Taranveer Singh'
  CHECK (char_length(author) BETWEEN 1 AND 80);

CREATE POLICY "Blog admins can update posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Blog admins can delete posts"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE TABLE public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  author_name TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 3 AND 2000),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX blog_comments_post_approved_created_idx
  ON public.blog_comments (post_id, approved, created_at);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved blog comments"
  ON public.blog_comments FOR SELECT
  TO anon, authenticated
  USING (approved = true);

CREATE POLICY "Blog admins can read all blog comments"
  ON public.blog_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Public can submit pending blog comments"
  ON public.blog_comments FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    approved = false
    AND char_length(author_name) BETWEEN 1 AND 80
    AND char_length(body) BETWEEN 3 AND 2000
  );

CREATE POLICY "Blog admins can moderate blog comments"
  ON public.blog_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Blog admins can delete blog comments"
  ON public.blog_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;

NOTIFY pgrst, 'reload schema';
