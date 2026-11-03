-- 002: real accounts (password login, avatars), reposts, sound lookup.

-- Accounts --------------------------------------------------------------------

-- NULL password_hash means the account cannot log in with a password
-- (only through dev login, if enabled). Format: scrypt$<N>$<salt hex>$<hash hex>.
ALTER TABLE users ADD COLUMN password_hash text;
-- Relative media path, e.g. 'uploads/avatars/<uuid>.jpg'. NULL = coloured initial.
ALTER TABLE users ADD COLUMN avatar_path text;

-- Store only a SHA-256 of each session token, never the token itself.
ALTER TABLE auth_tokens RENAME COLUMN token TO token_hash;
UPDATE auth_tokens SET token_hash = encode(sha256(convert_to(token_hash, 'UTF8')), 'hex');
ALTER TABLE auth_tokens ADD COLUMN last_used_at timestamptz;

-- Reposts ---------------------------------------------------------------------
-- A repost puts someone else's video on your profile ("Репосты" tab).

CREATE TABLE reposts (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id    bigint NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX reposts_video_idx ON reposts (video_id);
CREATE INDEX reposts_user_created_idx ON reposts (user_id, created_at DESC);

-- share_count = link shares + reposts.
CREATE TRIGGER reposts_count AFTER INSERT OR DELETE ON reposts
  FOR EACH ROW EXECUTE FUNCTION bump_video_counter('share_count');

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'reply', 'follow', 'repost'));
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;

-- Discovery -------------------------------------------------------------------

CREATE INDEX videos_sound_idx ON videos (sound_name);
