# Как вносить изменения

## Ветки

От `main`, имя по смыслу: `feat/camera-zoom`, `fix/comments-keyboard`, `docs/handoff`, `chore/deps`.
Одна задача — одна ветка — один pull request.

## Коммиты

Коротко, в повелительном наклонении, по-английски, с типом:

```
feat: add hashtag page
fix(feed): pause video when comments sheet opens
docs: update HANDOFF next tasks
```

Типы: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

## Проверки перед pull request

```bash
docker compose up -d
npm run migrate && npm run seed
npm run check          # typecheck сервера и приложения + тесты API
```

То же самое запускает GitHub Actions (`.github/workflows/ci.yml`).

Что ещё обязательно — в разделе «Definition of done» в [AGENTS.md](AGENTS.md): тесты на новые эндпоинты,
обновлённые `README.md` и `docs/`, новая миграция вместо правки старой, никаких секретов и чужих медиа
без записи в `media/CREDITS.md`.
