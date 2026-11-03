/**
 * Integration tests against a real PostgreSQL database.
 * They expect a migrated and freshly seeded database (npm run migrate && npm run seed)
 * at DATABASE_URL, and they modify it. Never point them at data you care about.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db.js';

let app: FastifyInstance;
const auth = { authorization: 'Bearer demo-token' };

before(async () => {
  app = await buildApp({ logger: false });
});
after(async () => {
  await app.close();
  await pool.end();
});

async function json<T = any>(method: string, url: string, body?: unknown, headers: Record<string, string> = auth) {
  const res = await app.inject({ method: method as 'GET', url, payload: body as object, headers });
  return { status: res.statusCode, body: res.json() as T };
}

describe('Loopa API', () => {
  it('health check talks to the database', async () => {
    const r = await json('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  });

  it('rejects writes without a token', async () => {
    const r = await json('POST', '/api/videos/1/like', undefined, {});
    assert.equal(r.status, 401);
  });

  it('for-you pages do not repeat videos within a round', async () => {
    const p1 = await json('GET', '/api/feed/for-you?limit=5');
    const p2 = await json('GET', `/api/feed/for-you?limit=5&cursor=${p1.body.nextCursor}`);
    const ids = [...p1.body.items, ...p2.body.items].map((v: any) => v.id);
    assert.equal(ids.length, 10);
    assert.equal(new Set(ids).size, 10);
  });

  it('following feed only has followed authors', async () => {
    const r = await json('GET', '/api/feed/following?limit=20');
    const handles = new Set(r.body.items.map((v: any) => v.author.handle));
    assert.ok(handles.size > 0);
    for (const h of handles) assert.ok(['dina.bakes', 'aru.moves', 'kairat.codes', 'timur.drone'].includes(h as string));
  });

  it('like / unlike updates the counter and notifies the author', async () => {
    const before = await json('GET', '/api/videos/4');
    const liked = await json('POST', '/api/videos/4/like');
    assert.equal(liked.body.likeCount, before.body.likeCount + 1);
    const again = await json('POST', '/api/videos/4/like');
    assert.equal(again.body.likeCount, before.body.likeCount + 1, 'like is idempotent');
    const n = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE type = 'like' AND video_id = 4");
    assert.equal(n.rows[0].n, 1);
    const unliked = await json('DELETE', '/api/videos/4/like');
    assert.equal(unliked.body.likeCount, before.body.likeCount);
    const n2 = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE type = 'like' AND video_id = 4");
    assert.equal(n2.rows[0].n, 0);
  });

  it('save shows up in Избранное', async () => {
    await json('POST', '/api/videos/3/save');
    const saved = await json('GET', '/api/users/demo/saved');
    assert.ok(saved.body.items.some((v: any) => v.id === 3));
    await json('DELETE', '/api/videos/3/save');
  });

  it('saved list is private', async () => {
    const r = await json('GET', '/api/users/dina.bakes/saved');
    assert.equal(r.status, 403);
  });

  it('new comment comes first and bumps comment_count', async () => {
    const before = await json('GET', '/api/videos/2/comments');
    const created = await json('POST', '/api/videos/2/comments', { body: 'тестовый комментарий' });
    assert.equal(created.status, 201);
    const afterList = await json('GET', '/api/videos/2/comments');
    assert.equal(afterList.body.items[0].id, created.body.id);
    assert.equal(afterList.body.total, before.body.total + 1);
    await json('DELETE', `/api/comments/${created.body.id}`);
  });

  it('follow / unfollow', async () => {
    const f = await json('POST', '/api/users/citrus.lab/follow');
    assert.equal(f.body.following, true);
    const p = await json('GET', '/api/users/citrus.lab');
    assert.equal(p.body.isFollowing, true);
    await json('DELETE', '/api/users/citrus.lab/follow');
    const p2 = await json('GET', '/api/users/citrus.lab');
    assert.equal(p2.body.isFollowing, false);
  });

  it('a completed view feeds the interest profile', async () => {
    await json('POST', '/api/videos/8/view', { watchedMs: 14000, completed: true });
    const i = await json('GET', '/api/me/interests');
    const tech = i.body.tags.find((t: any) => t.slug === 'техника');
    assert.ok(tech.completes >= 1);
    assert.equal(i.body.explorationRate, 0.2);
  });

  it('search finds users and captions', async () => {
    const r = await json('GET', `/api/search?q=${encodeURIComponent('кот')}`);
    assert.ok(r.body.videos.some((v: any) => v.author.handle === 'lazy.cats'));
  });

  it('inbox lists notifications for the demo user', async () => {
    const r = await json('GET', '/api/inbox');
    const types = new Set(r.body.items.map((n: any) => n.type));
    for (const t of ['like', 'comment', 'follow']) assert.ok(types.has(t), `inbox has ${t}`);
  });

  it('signup, login, wrong password, logout', async () => {
    const handle = `t${Date.now().toString(36)}`;
    const su = await json('POST', '/api/auth/signup', { handle, password: 'secret123', displayName: 'Тест' }, {});
    assert.equal(su.status, 201);
    assert.ok(su.body.token.length > 20);
    const dup = await json('POST', '/api/auth/signup', { handle, password: 'secret123' }, {});
    assert.equal(dup.status, 409);
    const bad = await json('POST', '/api/auth/login', { handle, password: 'nope-nope' }, {});
    assert.equal(bad.status, 401);
    const ok = await json('POST', '/api/auth/login', { handle: `@${handle.toUpperCase()}`, password: 'secret123' }, {});
    assert.equal(ok.status, 200);
    const me = await json('GET', '/api/me', undefined, { authorization: `Bearer ${ok.body.token}` });
    assert.equal(me.body.handle, handle);
    const stored = await pool.query('SELECT count(*)::int AS n FROM auth_tokens WHERE token_hash = $1', [ok.body.token]);
    assert.equal(stored.rows[0].n, 0, 'raw token is never stored');
    await json('POST', '/api/auth/logout', undefined, { authorization: `Bearer ${ok.body.token}` });
    const after = await json('GET', '/api/me', undefined, { authorization: `Bearer ${ok.body.token}` });
    assert.equal(after.status, 401);
  });

  it('seeded accounts log in with the dev password', async () => {
    const r = await json('POST', '/api/auth/login', { handle: 'dina.bakes', password: 'loopa-demo' }, {});
    assert.equal(r.status, 200);
  });

  it('two users: a comment from one shows up in the other one\'s inbox', async () => {
    const other = await json('POST', '/api/auth/dev-login', { handle: 'kamila.art' }, {});
    const h = { authorization: `Bearer ${other.body.token}` };
    const before = await json('GET', '/api/inbox/unread');
    const c = await json('POST', '/api/videos/10/comments', { body: 'видно с другого телефона' }, h);
    assert.equal(c.status, 201);
    const unread = await json('GET', '/api/inbox/unread');
    assert.equal(unread.body.count, before.body.count + 1);
    const inbox = await json('GET', '/api/inbox?limit=1');
    assert.equal(inbox.body.items[0].commentBody, 'видно с другого телефона');
    await json('POST', '/api/inbox/read');
    assert.equal((await json('GET', '/api/inbox/unread')).body.count, 0);
  });

  it('repost lands on the reposter profile and notifies the author', async () => {
    const r = await json('POST', '/api/videos/7/repost');
    assert.equal(r.body.reposted, true);
    const tab = await json('GET', '/api/users/demo/reposts');
    assert.ok(tab.body.items.some((v: any) => v.id === 7 && v.repostedByMe));
    const own = await json('POST', '/api/videos/10/repost');
    assert.equal(own.status, 400, 'cannot repost own video');
    await json('DELETE', '/api/videos/7/repost');
  });

  it('hashtag and sound pages', async () => {
    const tag = await json('GET', `/api/hashtags/${encodeURIComponent('танцы')}`);
    assert.equal(tag.status, 200);
    assert.ok(tag.body.items.length >= 2);
    assert.ok(tag.body.items.every((v: any) => v.author.handle === 'aru.moves'));
    const sound = await json('GET', `/api/sounds?name=${encodeURIComponent('оригинальный звук — lazy.cats')}`);
    assert.equal(sound.body.videoCount, 1);
    const s = await json('GET', `/api/search?q=${encodeURIComponent('#еда')}`);
    assert.ok(s.body.hashtags.some((h: any) => h.tag === 'еда'));
  });

  it('followers list is paginated', async () => {
    const p1 = await json('GET', '/api/users/demo/followers?limit=2');
    assert.equal(p1.body.items.length, 2);
    assert.ok(p1.body.nextCursor);
    const p2 = await json('GET', `/api/users/demo/followers?limit=2&cursor=${p1.body.nextCursor}`);
    assert.notEqual(p2.body.items[0].id, p1.body.items[0].id);
  });

  it('share page has Open Graph tags and an app link', async () => {
    const res = await app.inject({ method: 'GET', url: '/v/1' });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /<meta property="og:image" content="[^"]+01-donuts\.jpg">/);
    assert.match(res.body, /loopa:\/\/video\/1/);
  });

  it('avatar upload', async () => {
    const boundary = '----loopatest';
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/avatar',
      payload,
      headers: { ...auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.json().avatarUrl, /\/media\/uploads\/avatars\/.+\.png$/);
  });
});
