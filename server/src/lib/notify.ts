import type { Db } from '../db.js';

export type NotificationType = 'like' | 'comment' | 'reply' | 'follow' | 'repost';

interface NotifyArgs {
  recipientId: number;
  actorId: number;
  type: NotificationType;
  videoId?: number | null;
  commentId?: number | null;
}

/** Insert a notification unless the actor is notifying themselves. */
export async function notify(db: Db, a: NotifyArgs): Promise<void> {
  if (a.recipientId === a.actorId) return;
  await db.query(
    `INSERT INTO notifications (recipient_id, actor_id, type, video_id, comment_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [a.recipientId, a.actorId, a.type, a.videoId ?? null, a.commentId ?? null],
  );
}

/**
 * Remove the notification created by an action that was undone (unlike,
 * unfollow), so toggling a like ten times does not leave ten inbox rows.
 */
export async function retractNotification(
  db: Db,
  a: { recipientId: number; actorId: number; type: 'like' | 'follow' | 'repost'; videoId?: number | null },
): Promise<void> {
  await db.query(
    `DELETE FROM notifications
     WHERE recipient_id = $1 AND actor_id = $2 AND type = $3
       AND video_id IS NOT DISTINCT FROM $4`,
    [a.recipientId, a.actorId, a.type, a.videoId ?? null],
  );
}
