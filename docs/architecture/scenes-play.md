# `scenes/Play.ts` — заезд

**Роль:** единственный геймплейный цикл. Связывает жест, состояние заезда, камеру,
мир и HUD, в этом порядке — и ничего больше.
**Строк:** 33. **Экспортирует:** `Play` (сцена `play`).
**Использует:** `drive.ts` (`openRoad`, `steer`, `advance`, `run`), `input.ts`
(`dragReader`), `interface.ts` (`control`, `showGraphic`).

## Код

```ts
export const Play = {
    name: 'play',
    enter(): void {
        const draw = openRoad(), drag = dragReader();
        showGraphic('telemetry', 139, 79);
        const distance = game.text('0', 52, 96, {
            align: 'left', font: 'mono-bold', size: 38, color: '#fff4da', z: 8,
        });
        const hint = showGraphic('hint', 360, 1174);
        const pause = () => game.scenes.push('pause');
        control('pause-key', 653, 70, pause);
        game.step('drive', (dt) => {
            if (game.input.keyPressed('KeyP') || game.input.keyPressed('Escape')) {
                pause(); return;
            }
            const shift = steer(drag());
            advance(dt);
            draw(dt, shift / dt);
            distance.text = String(Math.floor(run.distance));
            hint.visible = run.hint;
        });
    },
};
```

## Разбор `enter()`

| Действие | Зачем |
|---|---|
| `openRoad()` | полный сброс и сборка: `run`, камера, дорога, болид |
| `dragReader()` | один ридер на заезд; живёт, пока сцена в стеке |
| `showGraphic('telemetry', 139, 79)` | панель «ДИСТАНЦИЯ / М» слева вверху |
| `game.text('0', 52, 96, ...)` | число дистанции; `align: 'left'` — `x` это левый край; `z: 8` — выше панели |
| `showGraphic('hint', 360, 1174)` | подсказка внизу; её `visible` управляется `run.hint` |
| `control('pause-key', 653, 70, pause)` | кнопка в правом верхнем углу |
| `game.step('drive', ...)` | шаг симуляции, принадлежит сцене |

Позиции: телеметрия `(139, 79)`, текст `(52, 96)` — чуть ниже и левее панели;
кнопка паузы `(653, 70)` — правый верх; подсказка `(360, 1174)` — по центру внизу.

## Порядок шага — важен

1. **Пауза** проверяется первой: если нажали P/Escape, шаг не двигает мир и
   возвращается. Это гарантирует, что пауза не «съедает» один кадр движения.
2. `steer(drag())` — сдвинуть болид на `dx` пикселей; возвращает **фактическое**
   смещение в метрах.
3. `advance(dt)` — время, скорость, дистанция.
4. `draw(dt, shift / dt)` — камера, секции мира, болид. `shift / dt` — px/с, из неё
   считается крен.
5. HUD: число дистанции (`Math.floor` — метры целыми) и видимость подсказки.

Почему `steer` до `advance`: позиция меняется мгновенно, а дистанция — интеграл; так
камера в этом кадре уже смотрит на новую позицию, а не на прошлую.

## Пауза

`game.scenes.push('pause')` — `play` остаётся в стеке, но его шаг перестаёт
вызываться. Мир, объекты и `run` сохраняются как есть. `pop()` возвращает сцену без
повторного `enter()`, поэтому заезд продолжается с того же места и той же скоростью.

Клавиши: `KeyP` и `Escape`. На кнопку — тот же `pause()`.

## Что можно добавить здесь

| Фича | Куда |
|---|---|
| счёт/очки, комбо | в `run` (`drive.ts`) + сюда в HUD |
| звук двигателя по `throttle` | `game.sound` в `enter`, обновление в шаге |
| тряска на скорости | `game.feel.shake(...)` (пак `feel` уже собран) |
| столкновения | пак `collision-3d`, правила в `enter` |
| финиш/экран результата | `game.scenes.go('over')` + новая сцена |
