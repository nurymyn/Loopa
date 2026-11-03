-- 001_init: core schema for Loopa.
-- Applied by scripts/migrate.ts inside a single transaction.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- People -------------------------------------------------------------------

CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  handle        text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9._]{2,30}$'),
  display_name  text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  bio           text NOT NULL DEFAULT '' CHECK (length(bio) <= 160),
  avatar_color  text NOT NULL DEFAULT '#B8F227',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Dev auth: a static bearer token per user. Not a real auth system.
CREATE TABLE auth_tokens (
  token       text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id);

CREATE TABLE follows (
  follower_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id);

-- Content ------------------------------------------------------------------

CREATE TABLE tags (
  slug   text PRIMARY KEY,          -- e.g. 'еда'
  label  text NOT NULL
);

CREATE TABLE videos (
  id              bigserial PRIMARY KEY,
  author_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption         text NOT NULL DEFAULT '' CHECK (length(caption) <= 300),
  sound_name      text NOT NULL DEFAULT '',
  media_path      text NOT NULL,        -- relative: 'seed/01-donuts.mp4' or 'uploads/<uuid>.mp4'
  thumbnail_path  text,                 -- relative, may be NULL for uploads without ffmpeg
  duration_ms     integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  width           integer,
  height          integer,
  -- Denormalised counters, kept in sync by triggers below.
  like_count      integer NOT NULL DEFAULT 0,
  comment_count   integer NOT NULL DEFAULT 0,
  save_count      integer NOT NULL DEFAULT 0,
  share_count     integer NOT NULL DEFAULT 0,
  view_count      bigint  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX videos_author_created_idx ON videos (author_id, created_at DESC, id DESC);
CREATE INDEX videos_created_idx ON videos (created_at DESC, id DESC);
CREATE INDEX videos_caption_trgm_idx ON videos USING gin (caption gin_trgm_ops);

CREATE TABLE video_tags (
  video_id  bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_slug  text   NOT NULL REFERENCES tags(slug) ON DELETE CASCADE,
  PRIMARY KEY (video_id, tag_slug)
);
CREATE INDEX video_tags_tag_idx ON video_tags (tag_slug);

-- Reactions ----------------------------------------------------------------

CREATE TABLE likes (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id    bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX likes_video_idx ON likes (video_id);
CREATE INDEX likes_user_created_idx ON likes (user_id, created_at DESC);

CREATE TABLE saves (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id    bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX saves_video_idx ON saves (video_id);
CREATE INDEX saves_user_created_idx ON saves (user_id, created_at DESC);

CREATE TABLE shares (
  id          bigserial PRIMARY KEY,
  user_id     bigint REFERENCES users(id) ON DELETE SET NULL,
  video_id    bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shares_video_idx ON shares (video_id);

-- One row per playback session reported by the app.
CREATE TABLE views (
  id          bigserial PRIMARY KEY,
  user_id     bigint REFERENCES users(id) ON DELETE SET NULL,
  video_id    bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched_ms  integer NOT NULL DEFAULT 0 CHECK (watched_ms >= 0),
  completed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX views_video_idx ON views (video_id);
CREATE INDEX views_user_completed_idx ON views (user_id, video_id) WHERE completed;

-- Comments -----------------------------------------------------------------

CREATE TABLE comments (
  id           bigserial PRIMARY KEY,
  video_id     bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  author_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id    bigint REFERENCES comments(id) ON DELETE CASCADE,  -- NULL = top-level
  body         text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  like_count   integer NOT NULL DEFAULT 0,
  reply_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_video_top_idx ON comments (video_id, created_at DESC, id DESC) WHERE parent_id IS NULL;
CREATE INDEX comments_parent_idx ON comments (parent_id, created_at, id) WHERE parent_id IS NOT NULL;

CREATE TABLE comment_likes (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id  bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

-- Notifications ------------------------------------------------------------

CREATE TABLE notifications (
  id            bigserial PRIMARY KEY,
  recipient_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('like', 'comment', 'reply', 'follow')),
  video_id      bigint REFERENCES videos(id) ON DELETE CASCADE,
  comment_id    bigint REFERENCES comments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC, id DESC);

-- Counter triggers ---------------------------------------------------------
-- Each reaction table bumps the matching counter on videos/comments, so the
-- API never has to COUNT(*) on hot paths.

CREATE FUNCTION bump_video_counter() RETURNS trigger AS $$
DECLARE
  col   text := TG_ARGV[0];
  delta integer := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  vid   bigint := CASE WHEN TG_OP = 'INSERT' THEN NEW.video_id ELSE OLD.video_id END;
BEGIN
  EXECUTE format('UPDATE videos SET %I = GREATEST(%I + $1, 0) WHERE id = $2', col, col)
    USING delta, vid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_count    AFTER INSERT OR DELETE ON likes    FOR EACH ROW EXECUTE FUNCTION bump_video_counter('like_count');
CREATE TRIGGER saves_count    AFTER INSERT OR DELETE ON saves    FOR EACH ROW EXECUTE FUNCTION bump_video_counter('save_count');
CREATE TRIGGER shares_count   AFTER INSERT OR DELETE ON shares   FOR EACH ROW EXECUTE FUNCTION bump_video_counter('share_count');
CREATE TRIGGER views_count    AFTER INSERT OR DELETE ON views    FOR EACH ROW EXECUTE FUNCTION bump_video_counter('view_count');
CREATE TRIGGER comments_count AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION bump_video_counter('comment_count');

CREATE FUNCTION bump_reply_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_reply_count AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION bump_reply_count();

CREATE FUNCTION bump_comment_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSE
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_likes_count AFTER INSERT OR DELETE ON comment_likes FOR EACH ROW EXECUTE FUNCTION bump_comment_like_count();

INSERT INTO tags (slug, label) VALUES
  ('еда', 'Еда'),
  ('юмор', 'Юмор'),
  ('природа', 'Природа'),
  ('танцы', 'Танцы'),
  ('техника', 'Техника');
