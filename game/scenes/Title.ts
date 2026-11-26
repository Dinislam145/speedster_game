import { game } from '../engine.js';
import { openRoad } from '../drive.js';
import { control, showGraphic } from '../interface.js';
export const Title = {
    name: 'title',
    enter(): void {
        const draw = openRoad();
        showGraphic('masthead', 360, 133);
        const start = () => game.scenes.go('play');
        control('start', 360, 1174, start);
        game.step('grid', (dt) => {
            draw(dt, 0);
            if (game.input.keyPressed('Space') || game.input.keyPressed('Enter')) start();
        });
    },
};
