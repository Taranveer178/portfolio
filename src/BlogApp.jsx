import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Download, ImagePlus, LockKeyhole, LogOut, Mail, Menu, PenLine, Upload, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from './supabase.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const STORAGE_BUCKET = 'blog-covers';
const CONTENT_BLOCKS_PREFIX = 'BLOG_BLOCKS_V1:';
const HTML_CONTENT_PREFIX = 'BLOG_HTML_V1:';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const toPost = (post) => ({
  ...post,
  coverImage: post.cover_image,
  createdAt: post.created_at,
});

const createContentBlock = (type = 'text') => ({
  id: crypto.randomUUID(),
  type,
  text: '',
  file: null,
  preview: '',
  url: '',
  caption: '',
});

function parseContentBlocks(content) {
  if (!content.startsWith(CONTENT_BLOCKS_PREFIX)) {
    return [{ id: 'legacy-content', type: 'text', text: content }];
  }
  try {
    const blocks = JSON.parse(content.slice(CONTENT_BLOCKS_PREFIX.length));
    if (Array.isArray(blocks)) return blocks;
  } catch {
    return [{ id: 'invalid-content', type: 'text', text: content.slice(CONTENT_BLOCKS_PREFIX.length) }];
  }
  return [{ id: 'invalid-content', type: 'text', text: content.slice(CONTENT_BLOCKS_PREFIX.length) }];
}

function getVideoEmbedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const videoId = host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return videoId && /^[\w-]{11}$/.test(videoId)
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const videoId = url.pathname.match(/\/(?:video\/)?(\d+)\/?$/)?.[1];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeBlogHtml(html) {
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'div', 'em',
      'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe',
      'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td',
      'th', 'thead', 'tr', 'u', 'ul',
    ],
    ALLOWED_ATTR: [
      'alt', 'allow', 'allowfullscreen', 'class', 'colspan', 'height', 'href', 'id',
      'loading', 'rel', 'rowspan', 'sandbox', 'src', 'style', 'target', 'title', 'width',
    ],
    ALLOW_DATA_ATTR: false,
  });
  const parsedHtml = new DOMParser().parseFromString(cleanHtml, 'text/html');

  parsedHtml.querySelectorAll('iframe').forEach((frame) => {
    const embedUrl = getVideoEmbedUrl(frame.getAttribute('src') || '');
    if (!embedUrl) {
      frame.remove();
      return;
    }
    frame.setAttribute('src', embedUrl);
    frame.setAttribute('title', frame.getAttribute('title') || 'Embedded video');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allowfullscreen', '');
  });

  parsedHtml.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.setAttribute('rel', 'noopener noreferrer');
  });

  return parsedHtml.body.innerHTML;
}

function ArticleContent({ content }) {
  if (content.startsWith(HTML_CONTENT_PREFIX)) {
    return (
      <div
        className="blog-html"
        dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(content.slice(HTML_CONTENT_PREFIX.length)) }}
      />
    );
  }

  const blocks = parseContentBlocks(content);
  return (
    <div className="space-y-7">
      {blocks.map((block, index) => {
        if (block.type === 'image' && typeof block.url === 'string') {
          return (
            <figure key={block.id || index}>
              <img src={block.url} alt={block.alt || ''} className="w-full rounded-2xl object-cover" loading="lazy" />
              {block.caption && <figcaption className="mt-2 text-center text-xs text-slate-500">{block.caption}</figcaption>}
            </figure>
          );
        }
        if (block.type === 'video' && typeof block.url === 'string') {
          const embedUrl = getVideoEmbedUrl(block.url);
          if (!embedUrl) {
            return <p key={block.id || index} className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">This video link is not supported.</p>;
          }
          return (
            <div key={block.id || index} className="aspect-video overflow-hidden rounded-2xl bg-slate-950">
              <iframe
                src={embedUrl}
                title="Embedded article video"
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          );
        }
        return (
          <p key={block.id || index} className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700 sm:text-base sm:leading-9">
            {typeof block.text === 'string' ? block.text : ''}
          </p>
        );
      })}
    </div>
  );
}

function getBlogErrorMessage(error, fallback) {
  if (
    error?.code === 'PGRST205'
    || /could not find the table ['"]?public\.blog_posts/i.test(error?.message || '')
  ) {
    return 'The blog table is not set up. Run supabase/migrations/20261117203000_create_blog.sql in the Supabase SQL Editor, then reload. If it already ran, refresh the API schema cache.';
  }
  return error?.message || fallback;
}

const createSlug = (title) => {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'post';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
};

const formatDate = (date) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(date));

function BlogHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainLinks = [
    { label: 'Introduction', id: 'top' },
    { label: 'ShareBills App', id: 'mobile-showcase' },
    { label: 'Projects Done', id: 'projects' },
    { label: 'Technical Stack', id: 'skills' },
  ];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between rounded-full border border-white/90 bg-white/85 px-4 py-2.5 shadow-lg shadow-blue-900/5 backdrop-blur-2xl sm:px-6">
        <a href="/#top" className="group flex items-center gap-2.5 text-left focus:outline-none">
          <img
            src="/assets/taranveer-favicon.webp"
            alt="Taranveer Singh"
            className="h-10 w-10 rounded-2xl object-cover shadow-md shadow-blue-600/20 transition-transform group-hover:scale-105"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif block text-base font-bold leading-none tracking-tight text-slate-900">Taranveer Singh</span>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" title="Full-Time Developer" />
            </div>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-blue-600">Online CV • Web Developer</span>
          </div>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {mainLinks.map((item) => (
            <a
              key={item.id}
              href={`/#${item.id}`}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              {item.label}
            </a>
          ))}
          <a href="/blog" className="rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">Blog</a>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <a
            href="/assets/Taranveer_Resume.pdf"
            download="Taranveer_Resume.pdf"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 text-xs font-bold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-100 active:scale-95"
          >
            <Download size={13} />
            <span>Download CV</span>
          </a>
          <a
            href="/#contact"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-700 hover:shadow-lg active:scale-95"
          >
            <span>Connect</span>
            <ArrowRight size={13} />
          </a>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <a href="/assets/Taranveer_Resume.pdf" download="Taranveer_Resume.pdf" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            CV
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/90 bg-white/90 text-slate-700 shadow-sm"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-[1200px] rounded-3xl border border-white/90 bg-white/95 p-4 shadow-2xl backdrop-blur-2xl lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {mainLinks.map((item) => (
              <a
                key={item.id}
                href={`/#${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-2xl bg-slate-100/80 px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              >
                {item.label}
              </a>
            ))}
            <a href="/blog" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-xs font-bold text-blue-700">
              Blog
            </a>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/70 pt-3">
            <a
              href="/assets/Taranveer_Resume.pdf"
              download="Taranveer_Resume.pdf"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700"
            >
              <Download size={14} />
              <span>View &amp; Download CV</span>
            </a>
            <a
              href="/#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20"
            >
              <Mail size={14} />
              <span>Get in Touch</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="relative z-10 border-t border-blue-900 bg-[#0A1322] text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/taranveer-favicon.webp" alt="Taranveer Singh" className="h-10 w-10 rounded-xl object-cover shadow-xs ring-1 ring-white/20" />
            <div>
              <p className="font-serif text-sm font-bold tracking-tight text-white">Taranveer Singh</p>
              <p className="mt-0.5 text-xs text-white/60">Full-Stack Web Developer • PHP, Laravel, React &amp; MySQL • Binary Data Pvt Ltd.</p>
            </div>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
            <a href="/#top" className="transition-colors hover:text-white">Intro</a>
            <a href="/#mobile-showcase" className="transition-colors hover:text-white">ShareBills</a>
            <a href="/#projects" className="transition-colors hover:text-white">Projects Done</a>
            <a href="/#resume" className="transition-colors hover:text-white">Resume CV</a>
            <a href="/#skills" className="transition-colors hover:text-white">Skills</a>
            <a href="/#contact" className="transition-colors hover:text-white">Connect</a>
            <a href="/blog" className="transition-colors hover:text-white">Blog</a>
          </nav>
        </div>
        <div className="flex flex-col gap-2 pt-5 text-[11px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Taranveer Singh. All rights reserved.</p>
          <p>Digital CV • Mohali, Punjab, India.</p>
        </div>
      </div>
    </footer>
  );
}

function BlogLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-200">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Poppins:wght@300;400;500;600;700&display=swap');
        .font-serif { font-family: 'Playfair Display', Georgia, serif; }
        .font-sans { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>
      <BlogHeader />
      {children}
      <BlogFooter />
    </div>
  );
}

function BlogIndex() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Blog — Taranveer Singh';
    if (!supabase) {
      setError('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect the blog.');
      setLoading(false);
      return;
    }

    supabase
      .from('blog_posts')
      .select('slug, title, excerpt, category, cover_image, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: requestError }) => {
        if (requestError) throw requestError;
        setPosts(data.map(toPost));
      })
      .catch((requestError) => setError(getBlogErrorMessage(requestError, 'The blog service is unavailable.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BlogLayout>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#0A1322] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              The developer journal
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Ideas, lessons &amp; <span className="text-blue-300">things I build.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Notes from the workbench: practical web development, useful discoveries, and the occasional lesson learned the hard way.
            </p>
            <a href="#latest" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-white transition hover:text-blue-200">
              Explore the latest <ArrowRight size={16} />
            </a>
          </div>
          <div aria-hidden="true" className="absolute bottom-8 right-10 hidden rotate-[-8deg] rounded-2xl border border-white/15 bg-white/5 p-5 shadow-2xl backdrop-blur sm:block">
            <BookOpen size={42} strokeWidth={1.2} className="text-blue-200" />
          </div>
        </section>

        <section id="latest" className="pt-14 sm:pt-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700">The reading list</p>
              <h2 className="font-serif mt-2 text-3xl font-bold tracking-tight text-slate-900">Latest writing</h2>
            </div>
            {!loading && !error && (
              <span className="pb-1 text-xs font-medium text-slate-500">{posts.length} {posts.length === 1 ? 'article' : 'articles'}</span>
            )}
          </div>
          {loading && <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading articles…</div>}
          {error && <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>}
          {!loading && !error && posts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><BookOpen size={22} /></span>
              <h3 className="font-serif mt-5 text-xl font-bold text-slate-900">The first story is on its way.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Check back soon for notes on building, learning, and shipping things for the web.</p>
            </div>
          )}
          {!loading && !error && posts.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <a
                  key={post.slug}
                  href={`/blog/${encodeURIComponent(post.slug)}`}
                  className={`group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-900/5 ${index === 0 ? 'md:col-span-2 md:grid md:grid-cols-2' : ''}`}
                >
                  {post.coverImage ? (
                    <img src={post.coverImage} alt="" className="h-52 w-full bg-slate-100 object-cover md:h-full md:min-h-64" />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 md:h-full md:min-h-64">
                      <BookOpen size={38} strokeWidth={1.2} className="text-blue-300 transition group-hover:scale-110" />
                    </div>
                  )}
                  <div className="flex flex-col p-6 sm:p-7">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                      <span>{post.category}</span><span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="inline-flex items-center gap-1.5 font-medium tracking-normal text-slate-500"><CalendarDays size={12} />{formatDate(post.createdAt)}</span>
                    </div>
                    <h3 className="font-serif mt-4 text-xl font-bold leading-snug text-slate-900 transition group-hover:text-blue-700 sm:text-2xl">{post.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-slate-900 group-hover:text-blue-700">
                      Read article <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </BlogLayout>
  );
}

function BlogPost({ slug }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setError('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect the blog.');
      setLoading(false);
      return;
    }

    supabase
      .from('blog_posts')
      .select('slug, title, excerpt, content, category, cover_image, created_at')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error: requestError }) => {
        if (requestError) throw requestError;
        if (!data) {
          setError('This article could not be found.');
          return;
        }
        const loadedPost = toPost(data);
        setPost(loadedPost);
        document.title = `${loadedPost.title} — Taranveer Singh`;
      })
      .catch((requestError) => setError(getBlogErrorMessage(requestError, 'The article service is unavailable.')))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <BlogLayout>
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <a href="/blog" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-blue-700"><ArrowLeft size={14} /> All articles</a>
        {loading && <p className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading article…</p>}
        {error && <div role="alert" className="mt-10 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>}
        {post && (
          <article className="mt-8">
            <header className="mx-auto max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
                <span>{post.category}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="inline-flex items-center gap-1.5 font-medium normal-case tracking-normal text-slate-500"><CalendarDays size={13} />{formatDate(post.createdAt)}</span>
              </div>
              <h1 className="font-serif mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">{post.title}</h1>
              <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">{post.excerpt}</p>
            </header>
            {post.coverImage && <img src={post.coverImage} alt="" className="mt-9 max-h-[520px] w-full rounded-[2rem] bg-slate-100 object-cover shadow-lg shadow-slate-900/5" />}
            <div className="mx-auto mt-10 max-w-3xl border-t border-slate-200 pt-8">
              <ArticleContent content={post.content} />
              <div className="mt-12 flex items-center justify-between border-t border-slate-200 pt-6">
                <a href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-blue-700"><ArrowLeft size={15} /> More articles</a>
                <a href="/" className="text-xs font-semibold text-slate-500 transition hover:text-blue-700">Back to portfolio</a>
              </div>
            </div>
          </article>
        )}
      </main>
    </BlogLayout>
  );
}

function AddBlog() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('Development');
  const [editorMode, setEditorMode] = useState('blocks');
  const [htmlContent, setHtmlContent] = useState('');
  const [blocks, setBlocks] = useState(() => [createContentBlock('text')]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const previewUrls = useRef(new Set());

  useEffect(() => {
    document.title = 'Write a blog post — Taranveer Singh';
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const insertBlockAfter = (index, type) => {
    setBlocks((current) => [
      ...current.slice(0, index + 1),
      createContentBlock(type),
      ...current.slice(index + 1),
    ]);
  };

  const updateBlock = (id, changes) => {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...changes } : block)));
  };

  const removeBlock = (id) => {
    const blockToRemove = blocks.find((block) => block.id === id);
    if (blockToRemove?.preview) {
      URL.revokeObjectURL(blockToRemove.preview);
      previewUrls.current.delete(blockToRemove.preview);
    }
    setBlocks((current) => {
      const remaining = current.filter((block) => block.id !== id);
      return remaining.length ? remaining : [createContentBlock('text')];
    });
  };

  const handleInlineImageChange = (id, event) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type)) {
      setError('Choose a JPG, PNG, WebP, or GIF image.');
      event.target.value = '';
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setError('Images must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const oldPreview = blocks.find((block) => block.id === id)?.preview;
    if (oldPreview) {
      URL.revokeObjectURL(oldPreview);
      previewUrls.current.delete(oldPreview);
    }
    const preview = URL.createObjectURL(selected);
    previewUrls.current.add(preview);
    setError('');
    updateBlock(id, { file: selected, preview });
    event.target.value = '';
  };

  const handleImageChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (selected && !IMAGE_TYPES.includes(selected.type)) {
      setError('Choose a JPG, PNG, WebP, or GIF image.');
      event.target.value = '';
      return;
    }
    if (selected && selected.size > MAX_IMAGE_SIZE) {
      setError('Cover images must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    setError('');
    setImage(selected);
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setSigningIn(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      setSession(data.session);
      setPassword('');
    } catch (signInError) {
      setError(signInError.message || 'Unable to sign in.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
    } catch (signOutError) {
      setError(signOutError.message || 'Unable to sign out.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const uploadedPaths = [];
    try {
      if (!supabase || !session) throw new Error('Sign in with an authorized admin account before publishing.');
      let serializedContent;

      if (editorMode === 'html') {
        const sanitizedHtml = sanitizeBlogHtml(htmlContent).trim();
        if (sanitizedHtml.length < 20) throw new Error('Add at least 20 characters of safe HTML content.');
        serializedContent = `${HTML_CONTENT_PREFIX}${sanitizedHtml}`;
      } else {
        const articleText = blocks.filter((block) => block.type === 'text').map((block) => block.text.trim()).join('\n');
        if (articleText.length < 20) throw new Error('Add at least 20 characters of article text.');

        for (const block of blocks) {
          if (block.type === 'image' && !block.file) throw new Error('Choose an image for every image block.');
          if (block.type === 'video' && !getVideoEmbedUrl(block.url)) {
            throw new Error('Use a valid YouTube or Vimeo video URL for every video block.');
          }
        }
      }

      const uploadImage = async (file) => {
        const extension = IMAGE_EXTENSIONS.get(file.type);
        if (!extension) throw new Error('Choose a JPG, PNG, WebP, or GIF image.');
        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      };

      let coverImage = null;
      if (image) coverImage = await uploadImage(image);

      if (editorMode === 'blocks') {
        const publishedBlocks = [];
        for (const block of blocks) {
          if (block.type === 'text') {
            publishedBlocks.push({ type: 'text', text: block.text });
          } else if (block.type === 'image') {
            publishedBlocks.push({
              type: 'image',
              url: await uploadImage(block.file),
              caption: block.caption,
            });
          } else if (block.type === 'video') {
            publishedBlocks.push({ type: 'video', url: getVideoEmbedUrl(block.url) });
          }
        }
        serializedContent = `${CONTENT_BLOCKS_PREFIX}${JSON.stringify(publishedBlocks)}`;
      }
      if (serializedContent.length > 50000) throw new Error('The combined article content must be under 50,000 characters.');

      const { data, error: insertError } = await supabase
        .from('blog_posts')
        .insert({
          slug: createSlug(title.trim()),
          title: title.trim(),
          excerpt: excerpt.trim(),
          category: category.trim(),
          content: serializedContent,
          cover_image: coverImage,
        })
        .select('slug')
        .single();

      if (insertError) throw insertError;

      uploadedPaths.length = 0;
      window.location.assign(`/blog/${encodeURIComponent(data.slug)}`);
    } catch (requestError) {
      if (uploadedPaths.length && supabase) {
        const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        if (cleanupError) {
          setError(`${requestError.message || 'Could not publish the article.'} Media cleanup failed: ${cleanupError.message}`);
        } else {
          setError(requestError.message || 'Could not publish the article.');
        }
      } else {
        setError(requestError.message || 'Could not publish the article.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const articleLength = editorMode === 'html' ? HTML_CONTENT_PREFIX.length + htmlContent.length : blocks.reduce((total, block) => (
    total
    + (block.type === 'text' ? block.text.length : 0)
    + (block.type === 'video' ? block.url.length : 0)
    + (block.type === 'image' ? block.caption.length : 0)
  ), 0);

  return (
    <BlogLayout>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <a href="/blog" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-blue-700"><ArrowLeft size={14} /> Back to blog</a>
        <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PenLine size={20} /></span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">The editor</p>
            <h1 className="font-serif mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Write a new post</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Create an article for the blog. Publishing access is protected by Supabase Auth and database policies.</p>
          </div>

          {!supabase ? (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then follow the Supabase setup steps in README.md.
            </p>
          ) : authLoading ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Checking admin session…</p>
          ) : !session ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">Admin email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">Password</span>
                <span className="relative block">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Your Supabase admin password"
                  />
                </span>
              </label>
              {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={signingIn}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LockKeyhole size={16} />
                {signingIn ? 'Signing in…' : 'Sign in to publish'}
              </button>
            </form>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-600">Signed in as <span className="font-bold text-slate-800">{session.user.email}</span></p>
                <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-rose-600">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">Post title</span>
              <input
                type="text"
                minLength={3}
                maxLength={120}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="A clear, memorable headline"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">Short introduction</span>
              <textarea
                minLength={20}
                maxLength={280}
                required
                rows={3}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="A short summary shown on the blog homepage (20–280 characters)"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">Category</span>
              <input
                type="text"
                maxLength={32}
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Development"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-bold text-slate-700">Cover image <span className="font-medium text-slate-400">· optional, max 5 MB</span></span>
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                  <img src={imagePreview} alt="Selected cover preview" className="max-h-64 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    aria-label="Remove cover image"
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-white transition hover:bg-rose-600"
                  ><X size={16} /></button>
                </div>
              ) : (
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-blue-400 hover:bg-blue-50/50">
                  <ImagePlus size={22} className="text-blue-600" />
                  <span className="mt-2 text-xs font-bold text-slate-700">Choose an image</span>
                  <span className="mt-1 text-[11px] text-slate-500">JPG, PNG, WebP, or GIF</span>
                  <input type="file" accept={IMAGE_TYPES.join(',')} onChange={handleImageChange} className="sr-only" />
                </label>
              )}
            </div>

            <section aria-label="Article content" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-700">Article content</span>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {editorMode === 'blocks'
                      ? 'Build your post with text, inline images, and YouTube or Vimeo embeds.'
                      : 'Write HTML directly. Scripts and unsupported embeds are removed before publishing.'}
                  </p>
                </div>
                <div role="group" aria-label="Article editor mode" className="inline-flex shrink-0 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    aria-pressed={editorMode === 'blocks'}
                    onClick={() => setEditorMode('blocks')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${editorMode === 'blocks' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Block editor
                  </button>
                  <button
                    type="button"
                    aria-pressed={editorMode === 'html'}
                    onClick={() => setEditorMode('html')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${editorMode === 'html' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    HTML source
                  </button>
                </div>
              </div>

              {editorMode === 'blocks' ? (
                <div className="space-y-4">
                  {blocks.map((block, index) => (
                    <div key={block.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      {block.type === 'text' ? 'Text block' : block.type === 'image' ? 'Image block' : 'Video embed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      aria-label={`Remove ${block.type} block`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {block.type === 'text' && (
                    <textarea
                      rows={5}
                      value={block.text}
                      onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-7 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="Write a paragraph..."
                    />
                  )}

                  {block.type === 'image' && (
                    <div className="space-y-3">
                      {block.preview && <img src={block.preview} alt={block.caption || 'Inline image preview'} className="max-h-72 w-full rounded-xl object-contain" />}
                      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-blue-400 hover:bg-blue-50/50">
                        <ImagePlus size={19} className="text-blue-600" />
                        <span className="mt-2 text-xs font-bold text-slate-700">{block.file ? 'Change image' : 'Choose image (max 5 MB)'}</span>
                        <input type="file" accept={IMAGE_TYPES.join(',')} onChange={(event) => handleInlineImageChange(block.id, event)} className="sr-only" />
                      </label>
                      {block.file && <p className="text-[11px] text-slate-500">{block.file.name}</p>}
                      <input
                        type="text"
                        maxLength={180}
                        value={block.caption}
                        onChange={(event) => updateBlock(block.id, { caption: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Image caption (optional)"
                      />
                    </div>
                  )}

                  {block.type === 'video' && (
                    <div className="space-y-3">
                      <input
                        type="url"
                        required
                        value={block.url}
                        onChange={(event) => updateBlock(block.id, { url: event.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Paste a YouTube or Vimeo link"
                      />
                      {getVideoEmbedUrl(block.url) && (
                        <div className="aspect-video overflow-hidden rounded-xl bg-slate-950">
                          <iframe
                            src={getVideoEmbedUrl(block.url)}
                            title="Video preview"
                            className="h-full w-full"
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => insertBlockAfter(index, 'text')} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                      + Text below
                    </button>
                    <button type="button" onClick={() => insertBlockAfter(index, 'image')} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                      + Image below
                    </button>
                    <button type="button" onClick={() => insertBlockAfter(index, 'video')} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                      + Video below
                    </button>
                  </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    maxLength={50000 - HTML_CONTENT_PREFIX.length}
                    rows={16}
                    value={htmlContent}
                    onChange={(event) => setHtmlContent(event.target.value)}
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder={'<h2>A section heading</h2>\n<p>Write your article using HTML...</p>\n<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Video"></iframe>'}
                  />
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sanitized preview</div>
                    <div
                      className="blog-html min-h-20 p-5"
                      dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(htmlContent) }}
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-slate-400">Switching modes keeps both drafts. Only the currently selected editor is published.</p>
                </div>
              )}
              <p className="text-right text-[11px] text-slate-400">{articleLength.toLocaleString()} / 50,000 characters</p>
            </section>

            {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <><Upload size={16} className="animate-pulse" /> Publishing…</> : <><CheckCircle2 size={16} /> Publish post</>}
            </button>
            <p className="text-center text-[11px] leading-5 text-slate-400">Your sign-in is checked by Supabase; only users listed as blog admins can publish.</p>
          </form>
            </>
          )}
        </div>
      </main>
    </BlogLayout>
  );
}

export default function BlogApp() {
  const pathname = window.location.pathname;
  if (pathname === '/add-blog') return <AddBlog />;
  if (pathname.startsWith('/blog/')) {
    const slug = decodeURIComponent(pathname.slice('/blog/'.length).replace(/\/+$/, ''));
    return slug ? <BlogPost slug={slug} /> : <BlogIndex />;
  }
  return <BlogIndex />;
}
