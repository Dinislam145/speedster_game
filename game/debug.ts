import { game } from './engine.js';
import { CRUISE, roadCheckpoint, run, seekDrive, selectMap, selectNightRoute } from './drive.js';
import type { RouteMode } from './route.js';

function jump(distance: number | undefined) {
    if (game.scenes.current !== 'play') return 'Start a drive first';
    if (distance === undefined) return 'Checkpoint unavailable on this route';
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
        name: 'route',
        args: 'seed [random|control]',
        does: 'Start a reproducible night route with a numeric seed',
        run: (value, mode = 'random') => {
            const seed = Number(value);
            if (
                !value ||
                !Number.isInteger(seed) ||
                seed < 0 ||
                seed > 0xffffffff ||
                (mode !== 'random' && mode !== 'control')
            )
                return 'Use an unsigned 32-bit seed and random or control';
            selectNightRoute(seed, mode as RouteMode);
            game.scenes.go('title');
            return mode + ' route, seed ' + seed;
        },
    });
    game.cheats.add({
        name: 'checkpoint',
        args: 'right|left|wrap|shop|narrow|left135|right135',
        does: 'Jump to a route checkpoint',
        run: (name) => jump(roadCheckpoint(name ?? '')),
    });
    game.cheats.add({
        name: 'seek',
        args: 'metres',
        does: 'Jump to a distance on the current route',
        run: (value) => {
            const distance = Number(value);
            return value && Number.isFinite(distance) && distance >= 0 && distance <= 100_000
                ? jump(distance)
                : 'Use a distance between 0 and 100000 m';
        },
    });
    game.cheats.add({
        name: 'longrun',
        does: 'Advance to two minutes',
        run: () => jump(119 * CRUISE),
    });
}
