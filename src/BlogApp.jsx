import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ImagePlus, LockKeyhole, PenLine, Upload, X } from 'lucide-react';

const BLOG_API_BASE = (import.meta.env.VITE_BLOG_API_URL || '/api').replace(/\/+$/, '');
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const apiUrl = (path) => `${BLOG_API_BASE}/${path.replace(/^\/+/, '')}`;
const imageUrl = (path) => new URL(path, `${new URL(BLOG_API_BASE, window.location.origin)}/`).toString();

async function fetchBlogApi(path, options) {
  const response = await fetch(apiUrl(path), options);
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('The blog API is not active on this domain yet. Deploy the Worker route for taranveer.in/api/* (see README.md).');
  }
  return { response, data: await response.json() };
}

const formatDate = (date) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(date));

function BlogHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F8FAFC]/90 px-4 backdrop-blur-xl sm:px-6">
      <nav className="mx-auto flex h-[76px] max-w-6xl items-center justify-between">
        <a href="/" className="flex items-center gap-3" aria-label="Back to Taranveer's portfolio">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <BookOpen size={19} />
          </span>
          <span>
            <span className="block font-serif text-lg font-bold leading-tight text-slate-900">Taranveer Singh</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">Notes &amp; ideas</span>
          </span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/" className="hidden text-sm font-semibold text-slate-600 transition hover:text-blue-700 sm:inline-flex">
            Portfolio
          </a>
          <a
            href="/add-blog"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            <PenLine size={14} />
            <span>Write a post</span>
          </a>
        </div>
      </nav>
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
      <p>© {new Date().getFullYear()} Taranveer Singh · Built with curiosity.</p>
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
    fetchBlogApi('posts')
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'The blog is temporarily unavailable.');
        return data;
      })
      .then((data) => setPosts(data.posts))
      .catch((requestError) => setError(requestError.message || 'The blog service is unavailable.'))
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
                    <img src={imageUrl(post.coverImage)} alt="" className="h-52 w-full bg-slate-100 object-cover md:h-full md:min-h-64" />
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
    fetchBlogApi(`posts/${encodeURIComponent(slug)}`)
      .then(({ response, data }) => {
        if (response.status === 404) throw new Error('This article could not be found.');
        if (!response.ok) throw new Error(data.error || 'The article is temporarily unavailable.');
        return data;
      })
      .then((data) => {
        setPost(data.post);
        document.title = `${data.post.title} — Taranveer Singh`;
      })
      .catch((requestError) => setError(requestError.message || 'The article service is unavailable.'))
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
            {post.coverImage && <img src={imageUrl(post.coverImage)} alt="" className="mt-9 max-h-[520px] w-full rounded-[2rem] bg-slate-100 object-cover shadow-lg shadow-slate-900/5" />}
            <div className="mx-auto mt-10 max-w-3xl border-t border-slate-200 pt-8">
              <div className="blog-prose whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700 sm:text-base sm:leading-9">{post.content}</div>
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
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('Development');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Write a blog post — Taranveer Singh';
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.set('title', title.trim());
    formData.set('excerpt', excerpt.trim());
    formData.set('category', category.trim());
    formData.set('content', content.trim());
    if (image) formData.set('image', image);

    try {
      const { response, data: result } = await fetchBlogApi('posts', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'That password was not accepted.' : result.error || 'The post could not be published.');
        return;
      }
      window.location.assign(`/blog/${encodeURIComponent(result.post.slug)}`);
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the blog service. Check the API URL and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BlogLayout>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <a href="/blog" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-blue-700"><ArrowLeft size={14} /> Back to blog</a>
        <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PenLine size={20} /></span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">The editor</p>
            <h1 className="font-serif mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Write a new post</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Create an article for the blog. Your password is sent securely to the blog API and is never saved in this browser.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">Admin password</span>
              <span className="relative block">
                <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter your publishing password"
                />
              </span>
            </label>

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

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-700">Article</span>
              <textarea
                minLength={20}
                maxLength={50000}
                required
                rows={14}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Write your article here. Line breaks are preserved in the published post."
              />
              <span className="mt-1 block text-right text-[11px] text-slate-400">{content.length.toLocaleString()} / 50,000</span>
            </label>

            {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <><Upload size={16} className="animate-pulse" /> Publishing…</> : <><CheckCircle2 size={16} /> Publish post</>}
            </button>
            <p className="text-center text-[11px] leading-5 text-slate-400">Your admin password is not stored. Only the server can authorize publishing.</p>
          </form>
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
