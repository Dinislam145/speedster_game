import { game } from '../engine.js';
import { advance, openRoad, run, steer } from '../drive.js';
import { control, showGraphic } from '../interface.js';
import { dragReader } from '../input.js';
export const Play = {
    name: 'play',
    enter(): void {
        const draw = openRoad(true),
            drag = dragReader();
        showGraphic('telemetry', 139, 79);
        const distance = game.text('0', 52, 96, {
            align: 'left',
            font: 'mono-bold',
            size: 38,
            color: '#fff4da',
            z: 8,
        });
        const hint = showGraphic('hint', 360, 1174);
        const pause = () => game.scenes.push('pause');
        control('pause-key', 653, 70, pause);
        game.step('drive', (dt) => {
            if (game.input.keyPressed('KeyP') || game.input.keyPressed('Escape')) {
                pause();
                return;
            }
            const shift = steer(drag());
            advance(dt);
            draw(dt, shift / dt);
            distance.text = String(Math.floor(run.distance));
            hint.visible = run.hint;
        });
    },
};
