const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function passwordsMatch(provided, expected) {
  const [providedDigest, expectedDigest] = await Promise.all([sha256(provided), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= providedDigest.charCodeAt(index) ^ expectedDigest.charCodeAt(index);
  }
  return difference === 0;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'post';
}

async function authorize(request, env) {
  if (!env.BLOG_ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Blog publishing is not configured.' }, 503);
  }
  const ipHash = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown');
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 900;
  const attempts = await env.DATABASE
    .prepare('SELECT failures, window_start FROM blog_auth_attempts WHERE ip_hash = ?')
    .bind(ipHash)
    .first();

  if (attempts && attempts.window_start > windowStart && attempts.failures >= 5) {
    return jsonResponse({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }

  const matches = await passwordsMatch(request.headers.get('X-Admin-Password') || '', env.BLOG_ADMIN_PASSWORD);
  if (!matches) {
    await env.DATABASE.prepare(`
      INSERT INTO blog_auth_attempts (ip_hash, failures, window_start)
      VALUES (?, 1, ?)
      ON CONFLICT(ip_hash) DO UPDATE SET
        failures = CASE WHEN blog_auth_attempts.window_start <= ? THEN 1 ELSE blog_auth_attempts.failures + 1 END,
        window_start = CASE WHEN blog_auth_attempts.window_start <= ? THEN excluded.window_start ELSE blog_auth_attempts.window_start END
    `).bind(ipHash, now, windowStart, windowStart).run();
    return jsonResponse({ error: 'Invalid publishing password.' }, 401);
  }

  await env.DATABASE.prepare('DELETE FROM blog_auth_attempts WHERE ip_hash = ?').bind(ipHash).run();
  return null;
}

async function listPosts(env) {
  const result = await env.DATABASE.prepare(`
    SELECT slug, title, excerpt, category, cover_image AS coverImage, created_at AS createdAt
    FROM blog_posts
    ORDER BY created_at DESC
    LIMIT 100
  `).all();
  return jsonResponse({ posts: result.results });
}

async function getPost(slug, env) {
  const post = await env.DATABASE.prepare(`
    SELECT slug, title, excerpt, content, category, cover_image AS coverImage, created_at AS createdAt
    FROM blog_posts
    WHERE slug = ?
  `).bind(slug).first();
  return post ? jsonResponse({ post }) : jsonResponse({ error: 'Post not found.' }, 404);
}

async function createPost(request, env) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data;')) {
    return jsonResponse({ error: 'A multipart form is required.' }, 415);
  }
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_IMAGE_BYTES + 100_000) {
    return jsonResponse({ error: 'The upload is too large.' }, 413);
  }

  const fields = await request.formData();
  const title = String(fields.get('title') || '').trim();
  const excerpt = String(fields.get('excerpt') || '').trim();
  const category = String(fields.get('category') || '').trim();
  const content = String(fields.get('content') || '').trim();
  const image = fields.get('image');

  if (title.length < 3 || title.length > 120) return jsonResponse({ error: 'Title must be 3–120 characters.' }, 400);
  if (excerpt.length < 20 || excerpt.length > 280) return jsonResponse({ error: 'Introduction must be 20–280 characters.' }, 400);
  if (category.length < 1 || category.length > 32) return jsonResponse({ error: 'Category must be 1–32 characters.' }, 400);
  if (content.length < 20 || content.length > 50_000) return jsonResponse({ error: 'Article must be 20–50,000 characters.' }, 400);

  let coverImage = null;
  if (image instanceof File && image.size > 0) {
    const extension = ALLOWED_IMAGE_TYPES.get(image.type);
    if (!extension) return jsonResponse({ error: 'Cover image must be JPG, PNG, WebP, or GIF.' }, 400);
    if (image.size > MAX_IMAGE_BYTES) return jsonResponse({ error: 'Cover images must be 5 MB or smaller.' }, 413);
    const key = `images/${crypto.randomUUID()}.${extension}`;
    await env.BLOG_IMAGES.put(key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type, cacheControl: 'public, max-age=31536000, immutable' },
    });
    coverImage = `/api/${key}`;
  }

  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  await env.DATABASE.prepare(`
    INSERT INTO blog_posts (slug, title, excerpt, content, category, cover_image, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(slug, title, excerpt, content, category, coverImage, createdAt).run();

  return jsonResponse({ post: { slug, title, excerpt, content, category, coverImage, createdAt } }, 201);
}

async function getImage(path, env) {
  const key = path.slice('/api/'.length);
  if (!/^images\/[0-9a-f-]+\.(jpg|png|webp|gif)$/.test(key)) {
    return new Response('Not found.', { status: 404 });
  }
  const image = await env.BLOG_IMAGES.get(key);
  if (!image) return new Response('Not found.', { status: 404 });
  const headers = new Headers();
  image.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(image.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found.', { status: 404 });

    const cors = corsHeaders(request, env);
    if (cors === null) return jsonResponse({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const path = url.pathname;
    let response;
    if (path.startsWith('/api/images/')) {
      if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405, cors);
      response = await getImage(path, env);
    } else if (path === '/api/posts' && request.method === 'GET') {
      response = await listPosts(env);
    } else if (path === '/api/posts' && request.method === 'POST') {
      const authError = await authorize(request, env);
      if (authError) return new Response(authError.body, { status: authError.status, headers: { ...Object.fromEntries(authError.headers), ...cors } });
      response = await createPost(request, env);
    } else if (path.startsWith('/api/posts/')) {
      if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405, cors);
      response = await getPost(decodeURIComponent(path.slice('/api/posts/'.length)), env);
    } else {
      response = jsonResponse({ error: 'Not found.' }, 404);
    }

    const headers = new Headers(response.headers);
    Object.entries(cors).forEach(([name, value]) => headers.set(name, value));
    return new Response(response.body, { status: response.status, headers });
  },
};
