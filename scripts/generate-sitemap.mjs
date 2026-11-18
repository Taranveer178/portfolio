import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const siteUrl = 'https://taranveer.in';
const pageSize = 1000;
const env = loadEnv('production', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to generate the blog sitemap.');
}

const postsUrl = new URL('/rest/v1/blog_posts', supabaseUrl);
postsUrl.searchParams.set('select', 'slug');
postsUrl.searchParams.set('order', 'created_at.asc');

const posts = [];
for (let offset = 0; ; offset += pageSize) {
  const response = await fetch(postsUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Range-Unit': 'items',
      Range: `${offset}-${offset + pageSize - 1}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load blog posts for the sitemap: ${response.status} ${response.statusText}`);
  }

  const page = await response.json();
  if (!Array.isArray(page)) throw new Error('Supabase returned an invalid sitemap post list.');
  posts.push(...page);
  if (page.length < pageSize) break;
}

const urls = [
  `${siteUrl}/`,
  `${siteUrl}/blog`,
  ...posts.map((post) => {
    if (typeof post.slug !== 'string' || !post.slug) {
      throw new Error('A blog post has a missing or invalid slug.');
    }
    return `${siteUrl}/blog/${encodeURIComponent(post.slug)}`;
  }),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((url) => `  <url><loc>${url.replace(/&/g, '&amp;')}</loc></url>`)
  .join('\n')}\n</urlset>\n`;

await Promise.all([
  writeFile(resolve('public', 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(resolve('dist', 'sitemap.xml'), sitemap, 'utf8'),
]);
console.log(`Generated sitemap with ${urls.length} URLs.`);
