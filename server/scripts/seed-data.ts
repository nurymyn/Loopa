// Hand-written demo data. Handles and people are fictional.
// Video files and their real sources are listed in media/manifest.json and media/CREDITS.md.

export interface SeedUser {
  handle: string;
  displayName: string;
  bio: string;
  color: string;
}

export const DEMO_HANDLE = 'demo';
/**
 * DEV ONLY. Public, documented credentials for the seeded demo database.
 * Never run the seed against a database that real people use.
 */
export const DEMO_PASSWORD = 'loopa-demo';
export const DEMO_TOKEN = 'demo-token';

export const users: SeedUser[] = [
  { handle: 'demo', displayName: 'Демо-аккаунт', bio: 'Это вы. Дев-аккаунт для проверки приложения.', color: '#B8F227' },
  { handle: 'dina.bakes', displayName: 'Дина Сапарова', bio: 'Пеку по выходным, ем всю неделю. Алматы', color: '#FF8A5B' },
  { handle: 'aru.moves', displayName: 'Аружан', bio: 'Танцую там, где есть место. Иногда там, где нет', color: '#C77DFF' },
  { handle: 'kairat.codes', displayName: 'Кайрат Б.', bio: 'Бэкенд днём, паяльник ночью', color: '#4CC9F0' },
  { handle: 'lazy.cats', displayName: 'Ленивые коты', bio: 'Два кота, одна миска, ноль стыда', color: '#FFD166' },
  { handle: 'timur.drone', displayName: 'Тимур Ахметов', bio: 'Снимаю сверху. Каспий, Алтай, Чарын', color: '#06D6A0' },
  { handle: 'sasha.kitchen', displayName: 'Саша на кухне', bio: 'Готовлю громко', color: '#EF476F' },
  { handle: 'citrus.lab', displayName: 'Citrus Lab', bio: 'Фрукты крупным планом', color: '#F8961E' },
  { handle: 'neon.nurik', displayName: 'Нурик', bio: 'Разбираю всё, что плохо лежит', color: '#90BE6D' },
  { handle: 'madi.kz', displayName: 'Мади', bio: '', color: '#577590' },
  { handle: 'zhanel_m', displayName: 'Жанель', bio: 'кофе и сериалы', color: '#F94144' },
  { handle: 'oleg.vtornik', displayName: 'Олег', bio: 'по вторникам смешно', color: '#43AA8B' },
  { handle: 'asel.reads', displayName: 'Асель', bio: 'читаю, пишу, сплю мало', color: '#B5838D' },
  { handle: 'bek.on.bike', displayName: 'Бек', bio: 'велик > такси', color: '#277DA1' },
  { handle: 'kamila.art', displayName: 'Камила', bio: 'рисую людей в метро', color: '#F9C74F' },
  { handle: 'yerlan.fit', displayName: 'Ерлан', bio: 'зал 5/7', color: '#4D908E' },
  { handle: 'lena.na.dache', displayName: 'Лена', bio: 'огород, кошки, внуки', color: '#9D4EDD' },
  { handle: 'daniyar_99', displayName: 'Данияр', bio: '', color: '#FF6B6B' },
  { handle: 'tomiris.tea', displayName: 'Томирис', bio: 'чай без сахара', color: '#00B4D8' },
];

/** [follower, followee] */
export const follows: [string, string][] = [
  ['demo', 'dina.bakes'],
  ['demo', 'aru.moves'],
  ['demo', 'kairat.codes'],
  ['demo', 'timur.drone'],
  ['madi.kz', 'demo'],
  ['zhanel_m', 'demo'],
  ['asel.reads', 'demo'],
  ['lazy.cats', 'demo'],
  ['dina.bakes', 'demo'],
  ['madi.kz', 'kairat.codes'],
  ['madi.kz', 'neon.nurik'],
  ['madi.kz', 'lazy.cats'],
  ['zhanel_m', 'aru.moves'],
  ['zhanel_m', 'dina.bakes'],
  ['zhanel_m', 'lazy.cats'],
  ['oleg.vtornik', 'lazy.cats'],
  ['oleg.vtornik', 'sasha.kitchen'],
  ['asel.reads', 'timur.drone'],
  ['asel.reads', 'citrus.lab'],
  ['bek.on.bike', 'timur.drone'],
  ['bek.on.bike', 'kairat.codes'],
  ['kamila.art', 'aru.moves'],
  ['kamila.art', 'citrus.lab'],
  ['yerlan.fit', 'aru.moves'],
  ['lena.na.dache', 'dina.bakes'],
  ['lena.na.dache', 'lazy.cats'],
  ['lena.na.dache', 'sasha.kitchen'],
  ['daniyar_99', 'neon.nurik'],
  ['daniyar_99', 'kairat.codes'],
  ['tomiris.tea', 'citrus.lab'],
  ['tomiris.tea', 'dina.bakes'],
  ['dina.bakes', 'sasha.kitchen'],
  ['sasha.kitchen', 'dina.bakes'],
  ['kairat.codes', 'neon.nurik'],
  ['neon.nurik', 'kairat.codes'],
  ['aru.moves', 'kamila.art'],
  ['timur.drone', 'bek.on.bike'],
];

/** [handle, body, likes, hoursAgo, replies?] */
export type SeedComment = [string, string, number, number, SeedComment[]?];

export interface SeedVideoExtra {
  /** Baseline counters, so the feed looks like a live app on day one. */
  likes: number;
  views: number;
  saves: number;
  shares: number;
  hoursAgo: number;
  comments: SeedComment[];
}

// Keyed by media file name from media/manifest.json.
export const videoExtras: Record<string, SeedVideoExtra> = {
  '01-donuts.mp4': {
    likes: 124500, views: 1_830_000, saves: 9100, shares: 2300, hoursAgo: 30,
    comments: [
      ['zhanel_m', 'это законно вообще так красиво посыпать?', 1204, 29],
      ['lena.na.dache', 'Дина, а тесто на дрожжах или на кефире? Внуки просят', 312, 27, [
        ['dina.bakes', 'На дрожжах, рецепт закреплю в профиле в субботу', 98, 26],
      ]],
      ['madi.kz', 'смотрю в 2 ночи. зачем я это делаю', 2890, 25],
      ['tomiris.tea', 'к чаю без сахара идеально, сахар уже в пончике', 145, 22],
      ['yerlan.fit', 'минус неделя зала за одно видео', 640, 20],
      ['oleg.vtornik', 'посыпка падает как мои планы на понедельник', 1730, 18],
      ['kamila.art', 'цвета как на картине, сохранила себе для референса', 88, 15],
      ['daniyar_99', 'где купить? в Алматы есть точка?', 41, 12, [
        ['dina.bakes', 'Пока только на заказ, пишите в директ', 17, 11],
      ]],
      ['asel.reads', 'звук хруста представила сама', 230, 8],
      ['bek.on.bike', 'надо ехать за пончиками на велике, тогда не считается', 512, 4],
    ],
  },
  '02-blue-dance.mp4': {
    likes: 37200, views: 412_000, saves: 1500, shares: 870, hoursAgo: 54,
    comments: [
      ['kamila.art', 'сорок дублей и ни одного видно что сороковой', 820, 53],
      ['yerlan.fit', 'ноги у тебя из чего сделаны', 310, 50],
      ['zhanel_m', 'шесть секунд пересмотрела раз двадцать', 1450, 47],
      ['madi.kz', 'синий фон соседу вернула?', 990, 44, [
        ['aru.moves', 'пока нет, он ещё не заметил', 1200, 43],
      ]],
      ['daniyar_99', 'а можно туториал медленно', 76, 40],
      ['oleg.vtornik', 'я так танцую когда нахожу 500 тенге в куртке', 2100, 33],
      ['tomiris.tea', 'энергия на весь день, спасибо', 54, 28],
      ['bek.on.bike', 'в наушниках что играет?', 37, 20],
      ['asel.reads', 'музыку бы подлиннее', 22, 9],
      ['lena.na.dache', 'молодец девочка, только спину береги', 410, 3],
    ],
  },
  '03-led-keyboard.mp4': {
    likes: 15600, views: 201_000, saves: 3400, shares: 410, hoursAgo: 75,
    comments: [
      ['daniyar_99', 'какие свитчи? звук приятный даже без звука', 520, 74, [
        ['kairat.codes', 'Тактильные, коричневые. Без звука в ролике, потому что сосед в кадре ругался', 610, 73],
      ]],
      ['neon.nurik', 'паял сам или готовая плата?', 140, 70],
      ['madi.kz', 'ещё бы код так красиво светился', 1100, 66],
      ['bek.on.bike', 'сколько стоило в итоге?', 63, 60],
      ['asel.reads', 'теперь хочу такую для ноутбука, хотя ничего не печатаю кроме сообщений', 98, 52],
      ['oleg.vtornik', 'соседи: слышат каждый коммит. Я: слышу каждый их ремонт. Мы квиты', 870, 44],
      ['zhanel_m', 'подсветку можно под настроение менять?', 35, 30],
      ['yerlan.fit', 'выглядит как пульт от космического корабля', 210, 22],
      ['kamila.art', 'фиолетовый лучше всех', 18, 14],
      ['tomiris.tea', 'а гудит?', 7, 6],
    ],
  },
  '04-two-cats.mp4': {
    likes: 451000, views: 5_200_000, saves: 22000, shares: 18400, hoursAgo: 100,
    comments: [
      ['oleg.vtornik', 'левый явно юрист', 8800, 99],
      ['lena.na.dache', 'у меня так же, только котов четыре и миска одна', 2300, 95],
      ['zhanel_m', 'рыжий ест, серый проверяет что рыжий не ест больше', 5100, 90],
      ['madi.kz', 'я и брат когда мама ставит одну тарелку пельменей', 6700, 86, [
        ['lazy.cats', 'точно, только у нас без драки, проверено', 1200, 85],
      ]],
      ['asel.reads', 'почти по-честному это самое честное слово', 430, 80],
      ['daniyar_99', 'звук бы включить, там наверняка чавканье', 300, 70],
      ['kamila.art', 'нарисую их, можно?', 210, 60, [
        ['lazy.cats', 'Конечно, отметьте нас потом', 140, 59],
      ]],
      ['tomiris.tea', 'миска маловата для двух таких серьёзных мужчин', 960, 44],
      ['bek.on.bike', 'смотрю четвёртый раз', 120, 30],
      ['yerlan.fit', 'коты на массе', 3300, 10],
    ],
  },
  '05-sea-waves.mp4': {
    likes: 98100, views: 1_100_000, saves: 14800, shares: 3100, hoursAgo: 140,
    comments: [
      ['bek.on.bike', 'это где? похоже на Каспий у Актау', 410, 139, [
        ['timur.drone', 'Да, под Актау. Ветер был такой, что дрон еле вернулся', 380, 138],
      ]],
      ['asel.reads', 'можно смотреть бесконечно, как огонь', 760, 130],
      ['zhanel_m', 'поставила на звонок будильника, пусть хоть утро будет красивым', 230, 120],
      ['kamila.art', 'цвет воды нереальный, фильтр?', 95, 110, [
        ['timur.drone', 'Без фильтров, только немного контраста', 120, 109],
      ]],
      ['madi.kz', 'дрон за сколько брал?', 44, 100],
      ['lena.na.dache', 'страшно смотреть, а оторваться не могу', 180, 90],
      ['tomiris.tea', 'успокаивает лучше чая', 150, 70],
      ['oleg.vtornik', 'камень держится лучше меня в понедельник', 1300, 50],
      ['daniyar_99', 'летом поеду туда, точку скинь', 30, 24],
      ['yerlan.fit', 'волны как на тренировке в пятницу', 15, 5],
    ],
  },
  '06-ladle-karaoke.mp4': {
    likes: 64000, views: 690_000, saves: 2900, shares: 5600, hoursAgo: 20,
    comments: [
      ['oleg.vtornik', 'половник вместо микрофона это уровень', 2400, 19],
      ['lena.na.dache', 'я так пою когда никого дома нет, а тут на весь интернет, смело', 870, 18],
      ['madi.kz', 'суп хоть сварился?', 1600, 17, [
        ['sasha.kitchen', 'Сварился, но пересолила от эмоций', 2100, 16],
      ]],
      ['zhanel_m', 'это я каждое воскресенье', 640, 15],
      ['dina.bakes', 'Саша, коллаб? Ты поёшь, я пеку', 950, 13, [
        ['sasha.kitchen', 'Давай! Только ты ведущая на кухне, я на вокале', 700, 12],
      ]],
      ['kamila.art', 'выражение лица на последней секунде лучшее', 310, 10],
      ['tomiris.tea', 'весёлая кухня вкуснее', 90, 8],
      ['daniyar_99', 'песня какая?', 25, 6],
      ['asel.reads', 'пересматриваю, когда грустно', 180, 3],
      ['yerlan.fit', 'кардио на кухне засчитано', 400, 1],
    ],
  },
  '07-citrus.mp4': {
    likes: 1200, views: 18_400, saves: 140, shares: 22, hoursAgo: 190,
    comments: [
      ['tomiris.tea', 'грейпфрут, без вариантов', 41, 189],
      ['zhanel_m', 'апельсин, грейпфрут горький', 37, 185, [
        ['citrus.lab', 'Горечь это плюс, просто к ней надо привыкнуть', 12, 184],
      ]],
      ['yerlan.fit', 'грейпфрут, сушка начинается', 28, 170],
      ['kamila.art', 'такой оранжевый фон хочу на стену', 19, 150],
      ['lena.na.dache', 'апельсин, детям нравится', 15, 140],
      ['madi.kz', 'а ответ какой правильный?', 22, 120, [
        ['citrus.lab', 'Тот, который в руке', 30, 119],
      ]],
      ['asel.reads', 'я за мандарин, его не позвали', 64, 100],
      ['daniyar_99', 'макро очень красивое', 6, 80],
      ['bek.on.bike', 'апельсин в бутылку с водой, и на велик', 9, 40],
      ['oleg.vtornik', 'грейпфрут это апельсин, который многое повидал', 210, 12],
    ],
  },
  '08-circuit-board.mp4': {
    likes: 8300, views: 96_000, saves: 1200, shares: 140, hoursAgo: 210,
    comments: [
      ['kairat.codes', 'роутер какой модели? плата знакомая', 120, 209, [
        ['neon.nurik', 'Старый двухдиапазонный, лет восемь ему. Работал до последнего', 64, 208],
      ]],
      ['daniyar_99', 'как город ночью сверху', 530, 200],
      ['bek.on.bike', 'вот бы так же красиво выглядел мой роутер, а не мигал', 220, 180],
      ['madi.kz', 'обратно собрал?', 140, 160, [
        ['neon.nurik', 'Нет. Это была дорога в один конец', 300, 159],
      ]],
      ['asel.reads', 'ничего не понимаю, но красиво', 410, 140],
      ['kamila.art', 'хочу такой узор на свитер', 80, 120],
      ['oleg.vtornik', 'вскрытие показало: роутер устал', 690, 90],
      ['zhanel_m', 'на какую камеру снимал макро?', 21, 60],
      ['yerlan.fit', 'дорожки как вены', 12, 30],
      ['tomiris.tea', 'залипла', 5, 7],
    ],
  },
  '09-red-lipstick-dance.mp4': {
    likes: 211000, views: 2_600_000, saves: 11800, shares: 7300, hoursAgo: 8,
    comments: [
      ['zhanel_m', 'пятница началась официально', 3200, 7],
      ['kamila.art', 'помада и свет просто идеально', 1800, 7],
      ['yerlan.fit', 'без хореографа а так двигаешься, это талант', 960, 6],
      ['madi.kz', 'пятничное настроение у меня: лечь', 4100, 6, [
        ['aru.moves', 'это тоже хореография, просто горизонтальная', 2600, 5],
      ]],
      ['oleg.vtornik', 'я на свадьбе после третьего тоста', 5300, 5],
      ['tomiris.tea', 'очень красиво', 120, 4],
      ['daniyar_99', 'песню скиньте', 70, 4],
      ['lena.na.dache', 'Аружан, ты ещё и красишься сама? Умница', 330, 3],
      ['asel.reads', 'включаю перед работой вместо кофе', 210, 2],
      ['bek.on.bike', 'свет откуда такой?', 44, 1],
    ],
  },
  '10-waterfall.mp4': {
    likes: 312, views: 4_100, saves: 37, shares: 6, hoursAgo: 48,
    comments: [
      ['timur.drone', 'Хороший кадр. Сверху ещё лучше было бы, бери дрон в следующий раз', 18, 47],
      ['asel.reads', 'где это? хочу туда', 9, 40],
      ['madi.kz', 'два часа пешком это сильно', 6, 33],
      ['lazy.cats', 'наши коты бы такое не пережили, они воду не любят', 22, 30],
      ['bek.on.bike', 'на велике туда можно доехать?', 4, 26],
      ['zhanel_m', 'звук воды бы', 3, 20],
      ['tomiris.tea', 'очень спокойно', 2, 14],
      ['dina.bakes', 'Красота. Пончики туда бы с собой', 7, 10],
      ['kamila.art', 'зелень такая сочная', 1, 6],
      ['lena.na.dache', 'береги себя в горах', 3, 2],
    ],
  },
};

/** Real reactions (rows in likes/saves) on top of the baseline numbers. */
export const demoLikes = ['01-donuts.mp4', '05-sea-waves.mp4'];
export const demoSaves = ['05-sea-waves.mp4'];
/** People who like the demo user's own video, so the inbox has "X понравилось ваше видео". */
export const likesOnDemoVideo = ['madi.kz', 'zhanel_m', 'asel.reads', 'timur.drone', 'lazy.cats', 'bek.on.bike'];
export const demoReposts = ['04-two-cats.mp4'];
export const repostsOfDemoVideo = ['madi.kz', 'asel.reads'];
