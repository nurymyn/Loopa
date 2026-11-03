# Видео для демо-данных: источники и лицензии

Все 10 роликов взяты с [Mixkit](https://mixkit.co/) (Envato). Сами файлы **не лежат в git**:
лицензия Mixkit разрешает использовать ролики в проекте, но не распространять их как отдельные файлы.
Каждый, кто клонирует репозиторий, скачивает их сам одной командой:

```bash
npm run media      # нужен ffmpeg
```

Скрипт `server/scripts/fetch-media.ts` берёт ссылки из `manifest.json`, обрезает каждый ролик до 14 секунд
(короче — остаются как есть), уменьшает до 540×960, убирает звук и делает превью `.jpg` из кадра на 1-й секунде.
Других изменений нет.

Ники, подписи, хэштеги, названия звуков и комментарии в приложении придуманы для демо и к авторам роликов
отношения не имеют. Названия звуков вида «Loopa Beats — …» вымышленные, реальной музыки в проекте нет.

| Файлы | Название на Mixkit | Автор на Mixkit | Источник | Лицензия |
|---|---|---|---|---|
| `01-donuts.mp4` / `01-donuts.jpg` | Sprinkles Falling onto Freshly Baked Donuts | mixkit | [страница](https://mixkit.co/free-stock-video/sprinkles-falling-onto-freshly-baked-donuts-100276/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `02-blue-dance.mp4` / `02-blue-dance.jpg` | Intense dance of a man with headphones on a blue background | mixkit | [страница](https://mixkit.co/free-stock-video/intense-dance-of-a-man-with-headphones-on-a-blue-51770/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `03-led-keyboard.mp4` / `03-led-keyboard.jpg` | Hands Typing on LED-decorated Keyboard | mixkit | [страница](https://mixkit.co/free-stock-video/hands-typing-on-led-decorated-keyboard-101546/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `04-two-cats.mp4` / `04-two-cats.jpg` | Two cats eating | marcolopez | [страница](https://mixkit.co/free-stock-video/two-cats-eating-1547/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `05-sea-waves.mp4` / `05-sea-waves.jpg` | Aerial view of sea waves crash at a rock | mixkit | [страница](https://mixkit.co/free-stock-video/aerial-view-of-sea-waves-crash-at-a-rock-51506/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `06-ladle-karaoke.mp4` / `06-ladle-karaoke.jpg` | Inspired Singing With Ladle Mic | mixkit | [страница](https://mixkit.co/free-stock-video/inspired-singing-with-ladle-mic-101073/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `07-citrus.mp4` / `07-citrus.jpg` | Orange and grapefruit fresh slices over a vibrant orange colored background | mixkit | [страница](https://mixkit.co/free-stock-video/orange-and-grapefruit-fresh-slices-over-a-vibrant-orange-colored-50800/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `08-circuit-board.mp4` / `08-circuit-board.jpg` | Circuit board | rubenvelasco | [страница](https://mixkit.co/free-stock-video/circuit-board-2381/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `09-red-lipstick-dance.mp4` / `09-red-lipstick-dance.jpg` | Vertical shot of a young woman with red lipstick dancing. | rubenvelasco | [страница](https://mixkit.co/free-stock-video/vertical-shot-of-a-young-woman-with-red-lipstick-dancing-49096/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `10-waterfall.mp4` / `10-waterfall.jpg` | Waterfall Between Green Hills | mixkit | [страница](https://mixkit.co/free-stock-video/waterfall-between-green-hills-100174/) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |

Лицензия: https://mixkit.co/license/#videoFree — бесплатно для личных и коммерческих проектов, указание авторства
не требуется, нельзя перепродавать или раздавать ролики как самостоятельные файлы. Перед публичным релизом
приложения перечитайте полный текст лицензии.

Иконка приложения (`mobile/assets/images/*.png`) нарисована скриптом для этого проекта, это не чужой логотип.
Иконки интерфейса — набор Ionicons из `@expo/vector-icons` (MIT).
