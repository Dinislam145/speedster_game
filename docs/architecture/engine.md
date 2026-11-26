# `engine.ts` — собранный движок (генерируется, не редактировать)

**Роль:** объект `game`, в который пекарня (bakery) «вкрутила» все паки из
`manifest.json`. Файл перезаписывается при каждой сборке.
**Строк:** 91. **Генерируется из:** `manifest.json` → `manifest.lock.json`.
**Импортируется:** каждым игровым файлом (`import { game } from './engine.js'`).

## Что экспортирует

| Экспорт | Что это |
|---|---|
| `game` | весь видимый API игры (`composed.game`) |
| `composed` | результат `createGame(screen).use(...)` — `{ game, signals }` |
| `signals` | шина сигналов движка (события сцен, ввода, ассетов) |
| `Obj<S>` / `Sprite<S>` / `Mesh<S>` / `Shape<S>` | тип объекта из `spawn()`, с типизированным `data` |
| `sheet(w, h, frames, draw)` | низкоуровневая отрисовка полосы кадров на `OffscreenCanvas` |

`Obj`, `Sprite`, `Mesh`, `Shape` — **один и тот же тип**, разные имена для удобства
чтения. `data` объявляется через `type`, не `interface` (иначе нет индексной
подписи и `spawn` не примет объект).

## Состав сборки (порядок = порядок `.use`)

| Пак | Что добавляет |
|---|---|
| `render-auto` | выбирает бэкенд: WebGPU, иначе WebGL2 |
| `world-3d` | 3D-мир: `spawn({ mesh })`, `world3d.defineMesh`, камера, `groundAt`, `pick` |
| `world-screen` | слой экрана/HUD, координаты в пикселях |
| `rig-orbit` | камера-орбита (`game.rig`), здесь с `drag:false`, `zoomSpeed:0` |
| `typography` | шрифты и `game.text` |
| `backdrops` | проход фонов под всем кадром |
| `backdrop-sky` / `backdrop-stars` | конкретные фоны (в игре не используются, кроме `background.picture`) |
| `geometry-3d` | примитивы (`box`, `cylinder`, `icosahedron`…) и билдеры мешей |
| `render-3d` | PBR, тени, туман, свет (`game.render3d.lighting`) |
| `lighting-3d` | точечные/прожекторные лампы (`game.lights`) — в игре не используются |
| `maths`, `color` | математика и цветовые утилиты |
| `audio` | синтез звука (`game.sound`) — в игре не используется |
| `ui` | кнопки, панели, фокус (`game.ui`) |
| `tween`, `save` | анимации и сохранения (не используются) |
| `particle-textures`, `particles-3d` | частицы (не используются) |
| `feel` | тряска/вспышка/хитстоп (не используется) |
| `attach-3d` | прикрепить объект к части модели (не используется) |
| `model-3d` | процедурные модели из спецификации (не используется) |
| `collision-3d` | коллизии (не используются) |
| `core-3d` | «скелет» 3D-игры: включает 23 пака выше, добавляет `game.background`, `game.moveDir`, `game.models` |
| `model-files-3d` | `game.modelFiles` — загрузка `.glb`/`.obj` |

Манифест перечисляет только верхний уровень (`core-3d`, `model-files-3d`,
`typography`, `backdrops`, `backdrop-sky`, `backdrop-stars`), остальное приходит из
`core-3d.include` (см. `game/node_modules/@phaser-ae/core-3d/pack.json`).

## Практические следствия

- **Возможности, которой нет в списке, нет и в `game`.** Нельзя «просто импортировать»
  физику или тайлмап — сначала пак в манифест, потом `npm run -s bake`.
- `game.rig.drag = false` уже стоит из конфигурации; `drive.ts` дублирует это на
  случай, если камеру когда-то сделают управляемой.
- Любая правка `engine.ts` вручную будет стёрта следующей сборкой. Меняйте
  `manifest.json`.
