import { game } from '../engine.js';
import { control, showGraphic } from '../interface.js';
export const Pause = {
    name: 'pause',
    enter(): void {
        game.spawn({
            id: 'shade',
            layer: 'hud',
            x: 360,
            y: 640,
            width: 720,
            height: 1280,
            tint: '#0d2934',
            alpha: 0.72,
        });
        showGraphic('pause-title', 360, 508);
        control('resume', 360, 639, () => game.scenes.pop());
        control('restart', 360, 740, () => game.scenes.go('play'));
        game.step('pause', () => {
            if (game.input.keyPressed('Escape') || game.input.keyPressed('KeyP')) game.scenes.pop();
        });
    },
};
