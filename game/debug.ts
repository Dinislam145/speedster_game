import { game } from './engine.js';
import { CRUISE, run, selectMap, seekDrive } from './drive.js';
import { RIGHT_ENTRY, LEFT_MIDDLE } from './route.js';
const CHECKPOINTS = { right: RIGHT_ENTRY, left: LEFT_MIDDLE, wrap: 311.3, shop: 34, longrun: 119 * CRUISE };
function jump(distance: number) {
    if (game.scenes.current !== 'play') return 'Start a drive first';
    seekDrive(distance);
    return 'Distance ' + distance + ' m';
}
export function addDebugControls(): void {
    game.inspect.state(() => ({ ...run }));
    game.cheats.add({
        name: 'map',
        args: 'night|day',
        does: 'Open a map on its starting grid',
        run: (map) => {
            if (map !== 'night' && map !== 'day') return 'Choose night or day';
            selectMap(map);
            game.scenes.go('title');
            return map;
        },
    });
    game.cheats.add({
        name: 'checkpoint',
        args: 'right|left|wrap|shop',
        does: 'Jump to a road checkpoint',
        run: (key) => {
            if (!Object.hasOwn(CHECKPOINTS, key ?? '')) return 'Choose right, left, wrap or shop';
            return jump(CHECKPOINTS[key as keyof typeof CHECKPOINTS]);
        },
    });
    game.cheats.add({
        name: 'longrun',
        does: 'Advance to two minutes',
        run: () => jump(CHECKPOINTS.longrun),
    });
}
