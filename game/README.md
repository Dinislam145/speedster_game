# Speedster

Вертикальный прототип гонки на Phaser AE с ядром `core-3d`. Для запуска из корня репозитория выполните `node phaser/cli/bin/phaser-ae.mjs serve`. CLI выведет адрес предпросмотра. Чтобы задать порт, добавьте `--port 4184`.

- [ТЗ на первый прототип](../docs/prototype-spec.md)
- [Управление, карта кода и проверка](NOTES.md)
- [Руководство по 3D-ядру](docs/make-a-3d-game.md)

Сборка и проверка из корня проекта:

```sh
node phaser/bin/bake.mjs build game dist
node phaser/bin/bake.mjs smoke game --seconds 125
```
