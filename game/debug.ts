import { game } from './engine.js';
import { CRUISE, roadCheckpoint, run, seekDrive, selectMap, selectNightRoute, selectTrafficSeed } from './drive.js';
import { toggleSafeRoute, toggleTrafficBoxes } from './traffic.js';
import type { RouteMode } from './route.js';

function jump(distance: number | undefined) {
    if (game.scenes.current !== 'play') return 'Start a drive first';
    if (distance === undefined) return 'Checkpoint unavailable on this route';
    seekDrive(distance);
    return 'Distance ' + distance + ' m';
}

export function addDebugControls(): void {
    // One state object: a second inspect.state would replace the first.
    game.inspect.state(() => ({
        ...run,
        lightsSent: game.lights.active,
        lightsAll: game.lights.all.length,
        lightsMax: game.lights.max,
    }));
    game.cheats.add({
        name: 'traffic-seed',
        args: 'seed|random',
        does: 'Set the traffic seed and restart the current drive',
        run: value => {
            const seed = Number(value);
            if (value !== 'random' && (!value || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff))
                return 'Use an unsigned 32-bit seed or random';
            selectTrafficSeed(value === 'random' ? undefined : seed);
            if (game.scenes.current === 'play') game.scenes.go('play');
            return 'Traffic seed ' + value;
        },
    });
    game.cheats.add({
        name: 'traffic-path',
        does: 'Toggle the safe route on the asphalt',
        run: () => toggleSafeRoute() ? 'Safe route visible' : 'Safe route hidden',
    });
    game.cheats.add({
        name: 'traffic-boxes',
        does: 'Show or hide NPC footprints',
        run: () => toggleTrafficBoxes() ? 'NPC footprints visible' : 'NPC footprints hidden',
    });
    game.cheats.add({
        name: 'probe',
        does: 'TEMP: report glow materials and spot lamps',
        run: () => {
            const lines: string[] = [];
            for (const key of ['illuminated-bollard', 'curb-light', 'vending-machine', 'minimart-facade']) {
                const model = game.modelFiles.get(key);
                if (!model) continue;
                lines.push(key + ': ' + model.parts.map((part) => {
                    const material = game.world3d.materialAt(part.material);
                    return (material?.name ?? '?').split(':').pop() + ' e=' + (material?.emissive.toFixed(2) ?? '?');
                }).join(', '));
            }
            const lamps = game.lights.all;
            lines.push('lamps ' + lamps.length + ' spots ' + lamps.filter(h => h.light3d.cone > 0).length);
            const eye = game.world3d.camera.eye;
            const ranges = lamps
                .map(h => Math.hypot(h.x - eye.x, h.y - eye.y, h.z - eye.z))
                .sort((a, b) => a - b);
            lines.push('range 160=' + (ranges[159]?.toFixed(0) ?? '-') +
                ' 256=' + (ranges[255]?.toFixed(0) ?? '-') +
                ' last=' + (ranges.at(-1)?.toFixed(0) ?? '-'));
            for (const key of ['curb-light', 'illuminated-bollard']) {
                const list = lamps.filter(h => h.id.startsWith('night-' + key + '-lamp'));
                const sample = list.slice(0, 2).map(h => {
                    const d = h.light3d;
                    return `r${d.radius.toFixed(0)} i${d.intensity.toFixed(0)} cone${(d.cone * 180 / Math.PI).toFixed(0)}` +
                        ` dir${(d.dir * 180 / Math.PI).toFixed(0)} pitch${(d.pitch * 180 / Math.PI).toFixed(0)}` +
                        ` on${d.on} y${h.y.toFixed(2)}`;
                });
                lines.push(key + ' x' + list.length + ': ' + sample.join(' | '));
            }
            return lines.join(' || ');
        },
    });
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
