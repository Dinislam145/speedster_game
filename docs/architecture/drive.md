# `drive.ts` — состояние заезда, управление и камера

**Роль:** «мозг» заезда. Хранит единственный объект состояния `run`, переводит
пиксели жеста в метры, двигает время и дистанцию, собирает дорогу и болид и каждый
шаг обновляет камеру. Это единственный файл, который знает про обе карты сразу.
**Строк:** 95. **Экспортирует:** `run`, `openRoad`, `advance`, `steer`, `seekDrive`,
`selectMap`, `activeMap`, `CRUISE`, тип `CityMap`.
**Используется:** `scenes/Title.ts`, `scenes/Play.ts`, `debug.ts`.

## Состояние

```ts
export const run = {
    time: 0,        // секунды с начала заезда
    distance: 0,    // метры, накопленные
    speed: 0,       // м/с
    x: 0,           // боковая позиция центра болида, −5…+5
    hint: true,     // показывать ли подсказку
    cycles: 0,      // сколько раз пройден CIRCUIT_LENGTH
    map: activeMap, // 'night' | 'day' — копия для inspect
    sections: 0,    // сколько секций вернул билдер дороги
};
```

Всё состояние заезда — здесь. Это сделано специально: читы и `inspect` могут
поставить/прочитать любое поле, не разыскивая объекты по сцене.

## Константы

| Имя | Значение | Смысл |
|---|---|---|
| `CRUISE` | 40 м/с | крейсерская скорость (144 км/ч) |
| `ACCEL_TIME` | 2 с | время разгона до крейсерской |
| `MAX_X` | `(12 − 2)/2 = 5` м | предел бокового смещения центра |
| `CAMERA_DISTANCE` | 20.5 м | отъезд камеры |
| `CAMERA_PITCH` | 0.215 рад | наклон вниз |
| `LOOK_AHEAD` | 9.1 м | точка взгляда впереди |
| `CAMERA_LAG` | 10 1/с | скорость догона камерой |

## Функции

### `selectMap(map)` / `activeMap`

`activeMap` — модульная переменная, которую меняет только `selectMap`. Влияет на
следующий `openRoad()`: ночь → `buildNightCity()`, день → `buildHighway()`.
`selectMap` не перестраивает мир сам — чит `map` после него делает `go('title')`.

### `seekDrive(distance)`

Ставит состояние так, как будто игрок проехал `distance` метров:

```ts
rampDistance = CRUISE · ACCEL_TIME / 2 = 40 м
time = distance < 40 ? sqrt(2 · ACCEL_TIME · distance / CRUISE)
                     : ACCEL_TIME + (distance − 40) / CRUISE
speed = CRUISE · min(1, time / ACCEL_TIME)
cycles = floor(distance / 312)
```

То есть обратная операция к `advance`: разгон считается как равноускоренное
движение, крейсер — как линейное. Используется читами (`longrun` = 119 с ≈ 4760 м).

### `advance(dt)`

```ts
run.time += dt;
run.speed = CRUISE · min(1, run.time / ACCEL_TIME);
run.distance += (before + run.speed) / 2 · dt;
```

Скорость растёт линейно первые 2 с (ускорение 20 м/с²), дистанция интегрируется
трапецией — точно, без зависимости от шага.

### `steer(deltaPixels)`

```ts
run.x = clamp(run.x + deltaPixels · (2·MAX_X) / (0.5 · screen.width), −MAX_X, +MAX_X)
if (изменилось) run.hint = false
return run.x − before
```

При ширине экрана 720 px: **1 px = 10/360 ≈ 0.0278 м**, полэкрана (360 px) = все
10 м дороги. Возвращает фактическое смещение — это нужно болиду для крена (на
упёршемся в борт жесте смещение 0, крен не растёт).

### `openRoad()`

Главная сборка заезда. Вызывается из `enter()` обеих сцен.

1. `Object.assign(run, {...})` — полный сброс состояния.
2. Камера: `pan = false`, `drag = false`, `pitch`, `yaw = π`, `distance`,
   `focus(0, 1, −LOOK_AHEAD)`.
3. `night = activeMap === 'night'`; `road = night ? buildNightCity() : buildHighway()`;
   `vehicle = spawnVehicle(night)`.
4. Возвращает функцию `draw(dt, lateralSpeed)`:

| Шаг `draw` | Что делает |
|---|---|
| `desired = run.x · 0.91` | цель камеры: 91 % смещения болида |
| `cameraX += (desired − cameraX) · (1 − e^(−10·dt))` | экспоненциальное сглаживание, независимое от FPS |
| `cameraX = clamp(run.x ± 1.45)` | болид не выходит из кадра при рывке |
| `rig.focus(cameraX, 1, −LOOK_AHEAD)` | камера смотрит вперёд |
| ночь: `rig.yaw = π + heading(distance+9.1) − heading(distance)` | упреждение поворота |
| `run.sections = road(run.distance)` | переставить/переодеть секции |
| `vehicle(run.x, lateralSpeed, speed/CRUISE, clock, dt)` | болид, крен, тяга |

`draw(0, 0)` вызывается сразу в конце `openRoad()` — первый кадр уже правильный,
без «прыжка» после `enter()`.

## Порядок вызовов в шаге `drive`

```ts
const shift = steer(drag());   // 1. сдвинуть болид
advance(dt);                   // 2. продвинуть время и дистанцию
draw(dt, shift / dt);          // 3. камера + мир + болид
```

`shift / dt` — боковая скорость в px/с; её использует крен. Если `dt` мал, скорость
большая — крен резче.

## Что менять

| Ощущение | Константа |
|---|---|
| быстрее едет | `CRUISE` |
| дольше разгон | `ACCEL_TIME` |
| чувствительнее руль | делитель в `steer` (`0.5 · screen.width`) |
| камера выше/ниже | `CAMERA_PITCH` |
| камера дальше | `CAMERA_DISTANCE` |
| камера смотрит дальше | `LOOK_AHEAD` |
| камера жёстче следует | `CAMERA_LAG` |
| болид сильнее «уезжает» в кадре | множитель `0.91` и кламп `1.45` |
