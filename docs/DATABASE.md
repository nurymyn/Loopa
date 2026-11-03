# База данных

PostgreSQL 16. Других хранилищ данных нет: всё, что видит пользователь, лежит в этих таблицах, кроме самих
файлов видео и фото (они на диске, в базе — путь к ним).

## Миграции

Файлы `server/migrations/NNN_описание.sql`. `npm run migrate` (скрипт `server/scripts/migrate.ts`) применяет по
порядку те, которых ещё нет в таблице `schema_migrations`, каждую в своей транзакции. Если миграция падает,
она откатывается целиком.

| Файл | Что делает |
|---|---|
| `001_init.sql` | Пользователи, токены, подписки, теги, видео, лайки, избранное, «поделиться», просмотры, комментарии, лайки комментариев, уведомления, триггеры счётчиков, 5 тегов |
| `002_accounts_reposts.sql` | Пароли и фото профиля, токены хранятся как SHA-256, таблица репостов, тип уведомления `repost`, индекс по звуку |

Правило: миграцию, которая уже попала в `main`, не редактируют. Нужно изменение — новая миграция со
следующим номером.

```bash
docker compose up -d     # PostgreSQL на localhost:5432, пользователь/пароль/база: loopa/loopa/loopa
npm run migrate          # из корня репозитория
npm run seed             # СТИРАЕТ все данные и заливает демо-набор
```

Строка подключения — `DATABASE_URL` (по умолчанию `postgres://loopa:loopa@localhost:5432/loopa`).
Посмотреть базу руками: `docker compose exec db psql -U loopa loopa`. Без Docker: `psql -U loopa loopa`
(на Windows — SQL Shell (psql) из меню «Пуск», пользователь и база `loopa`).

В pgAdmin 4 (на Windows ставится вместе с PostgreSQL): Servers → PostgreSQL 16
(пароль пользователя `postgres`, заданный при установке) → Databases → loopa → Schemas → public → Tables, правый клик по таблице → View/Edit Data → All Rows.
Свой SQL: правый клик по `loopa` → Query Tool, запуск — F5. Например, аккаунты:
`SELECT id, handle, display_name, created_at FROM users ORDER BY id DESC;`. Пароли хранятся только как
`password_hash` (scrypt). `npm run seed` создаёт 19 демо-аккаунтов с `id` 1–19, зарегистрированные в приложении
идут после них. Повторный `seed` удаляет и их.

## Таблицы

| Таблица | Что хранит | Ключ и важные поля |
|---|---|---|
| `users` | Аккаунты | `id`, `handle` (уникальный, `^[a-z0-9._]{2,30}$`), `display_name`, `bio` (до 160), `avatar_color`, `avatar_path`, `password_hash` (NULL — вход только через демо) |
| `auth_tokens` | Сессии | `token_hash` (SHA-256 токена), `user_id`, `created_at`, `last_used_at` |
| `follows` | Кто на кого подписан | PK `(follower_id, followee_id)`, нельзя подписаться на себя |
| `tags` | Темы для «Для вас» | `slug`: еда, юмор, природа, танцы, техника |
| `videos` | Видео | `author_id`, `caption` (до 300), `sound_name`, `media_path`, `thumbnail_path`, `duration_ms`, `width`, `height`, счётчики `like_count`, `comment_count`, `save_count`, `share_count`, `view_count` |
| `video_tags` | Теги видео | PK `(video_id, tag_slug)` |
| `likes` | Лайки видео | PK `(user_id, video_id)` |
| `saves` | «Избранное» | PK `(user_id, video_id)` |
| `reposts` | Репосты в профиль | PK `(user_id, video_id)` |
| `shares` | Каждая выданная ссылка «Поделиться» | `user_id` (может быть NULL), `video_id` |
| `views` | Просмотры (один «визит» = строка) | `user_id`, `video_id`, `watched_ms`, `completed` |
| `comments` | Комментарии и ответы | `video_id`, `author_id`, `parent_id` (NULL — верхний уровень), `body` (1–500), `like_count`, `reply_count` |
| `comment_likes` | Лайки комментариев | PK `(user_id, comment_id)` |
| `notifications` | «Входящие» | `recipient_id`, `actor_id`, `type` (`like`, `comment`, `reply`, `follow`, `repost`), `video_id`, `comment_id`, `read_at` |
| `schema_migrations` | Применённые миграции | `name`, `applied_at` |

Удаление пользователя или видео каскадно удаляет всё связанное (`ON DELETE CASCADE`), кроме `shares` и
`views`, где `user_id` становится NULL — статистика видео сохраняется.

## Счётчики и триггеры

Счётчики в `videos` и `comments` не считаются запросом каждый раз — их двигают триггеры:

| Триггер | Таблица | Что меняет |
|---|---|---|
| `likes_count` | `likes` | `videos.like_count` |
| `saves_count` | `saves` | `videos.save_count` |
| `shares_count`, `reposts_count` | `shares`, `reposts` | `videos.share_count` |
| `views_count` | `views` | `videos.view_count` |
| `comments_count` | `comments` | `videos.comment_count` (включая ответы) |
| `comments_reply_count` | `comments` | `comments.reply_count` у родителя |
| `comment_likes_count` | `comment_likes` | `comments.like_count` |

Счётчик не уходит ниже нуля (`GREATEST(x - 1, 0)`). Демо-данные задают стартовые числа (например, 124 500 лайков)
прямо в `videos`, а настоящие строки `likes` прибавляются к ним. Поэтому `like_count` в демо-базе больше, чем
`COUNT(*)` по `likes` — так задумано.

## Индексы

| Индекс | Зачем |
|---|---|
| `videos_created_idx (created_at DESC, id DESC)` | Пагинация по времени |
| `videos_author_created_idx (author_id, created_at DESC, id DESC)` | Видео автора, лента «Подписки» |
| `videos_caption_trgm_idx` (GIN, `pg_trgm`) | Поиск по подписи через `ILIKE '%…%'` |
| `videos_sound_idx (sound_name)` | Страница звука |
| `video_tags_tag_idx (tag_slug)` | Видео по тегу |
| `follows_followee_idx (followee_id)` | Подписчики пользователя |
| `likes_video_idx`, `likes_user_created_idx` | Лайки видео; «Понравившиеся» в профиле |
| `saves_*`, `reposts_*` | То же для избранного и репостов |
| `views_user_completed_idx (user_id, video_id) WHERE completed` | Досмотры для «Для вас» |
| `comments_video_top_idx (video_id, created_at DESC, id DESC) WHERE parent_id IS NULL` | Список комментариев |
| `comments_parent_idx (parent_id, created_at, id) WHERE parent_id IS NOT NULL` | Ответы |
| `notifications_recipient_idx (recipient_id, created_at DESC, id DESC)` | «Входящие» |
| `notifications_unread_idx (recipient_id) WHERE read_at IS NULL` | Счётчик непрочитанного |
| `auth_tokens_user_idx (user_id)` | Токены пользователя |

## Демо-данные

`npm run seed` (`server/scripts/seed.ts` + `seed-data.ts`):

- 19 вымышленных пользователей, у всех пароль `loopa-demo` (**только для разработки**), у `@demo` дополнительно
  токен `demo-token` для `curl`;
- 37 подписок;
- 10 видео из `media/manifest.json` с тегами, подписями, звуками и стартовыми счётчиками;
- 115 комментариев с ответами, написанных вручную;
- лайки, избранное и репосты демо-пользователя и уведомления для него.

Перед заливкой `seed` проверяет, что ролики скачаны (`npm run media`). В CI проверка отключается
переменной `SEED_ALLOW_MISSING_MEDIA=true` — тесты не воспроизводят видео.
