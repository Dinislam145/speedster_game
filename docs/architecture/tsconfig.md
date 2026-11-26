# `tsconfig.json` — настройки TypeScript игры

**Роль:** как компилировать `game/**/*.ts` при проверке типов. Сборку бандла делает
`phaser/bin/bake.mjs`, но типы проверяются именно этими настройками
(`npm run -s typecheck`).

## Содержимое и смысл

| Опция | Значение | Зачем |
|---|---|---|
| `extends` | `../phaser/tsconfig.base.json` | общая база (strict, target, lib) |
| `noUncheckedIndexedAccess` | `false` | индексация массивов без `!`/проверок — код города активно читает `pool[index]` |
| `exactOptionalPropertyTypes` | `false` | позволяет `texture?: string` передавать как `undefined` |
| `module` / `moduleResolution` | `ESNext` / `Bundler` | импорты с `.js` в пути, как требует ESM-сборка |
| `paths` | `@phaser-ae/kernel` → `phaser/engine/kernel/src/index.ts` | типы ядра берутся **из исходников**, а не из `dist`, поэтому подсказки и ошибки соответствуют реальному коду |
| `typeRoots` | `phaser/node_modules/@types`, `phaser/node_modules` | глобальные типы движка |
| `include` / `exclude` | `**/*.ts` / `node_modules`, `dist` | компилируется вся папка `game` |

База (`phaser/tsconfig.base.json`) включает `strict: true`. Отсюда практические
следствия для игрового кода:

- `null`/`undefined` надо проверять (`frames.get(key)!` в `interface.ts`).
- `Map.get()` возвращает `T | undefined` — в `interface.ts` стоит `!`, потому что
  ключ гарантированно зарегистрирован.
- `Record<string, unknown>` для `data` объявляется через `type`, не `interface`.

## Что менять

- Включить `noUncheckedIndexedAccess: true` — придётся переписать обращения
  `slot.pieces[id]`, `BASES[style]`, `[18.8, 9.6, 5.4][frontage]` с проверками.
- Добавить алиасы путей, если появятся подпапки (`@game/*`).
