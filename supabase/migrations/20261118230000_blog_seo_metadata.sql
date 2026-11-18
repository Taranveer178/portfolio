ALTER TABLE public.blog_posts
  ADD COLUMN seo_title TEXT CHECK (char_length(seo_title) BETWEEN 1 AND 120),
  ADD COLUMN seo_description TEXT CHECK (char_length(seo_description) BETWEEN 1 AND 280),
  ADD COLUMN seo_keywords TEXT CHECK (char_length(seo_keywords) BETWEEN 1 AND 500);

NOTIFY pgrst, 'reload schema';
