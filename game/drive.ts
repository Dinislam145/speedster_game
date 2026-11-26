import { game } from './engine.js';
import { buildHighway, ROAD_WIDTH, CIRCUIT_LENGTH } from './highway.js';
import { spawnVehicle, CRAFT_WIDTH } from './vehicle.js';
import { buildNightCity } from './night-city.js';
import { routeAt } from './route.js';

export type CityMap = 'night' | 'day';
export let activeMap: CityMap = 'night';
export function selectMap(map: CityMap): void {
    activeMap = map;
}

export const CRUISE = 40;
const ACCEL_TIME = 2,
    MAX_X = (ROAD_WIDTH - CRAFT_WIDTH) / 2;
const CAMERA_DISTANCE = 20.5,
    CAMERA_PITCH = 0.215,
    LOOK_AHEAD = 9.1,
    CAMERA_LAG = 10;
export const run = {
    time: 0,
    distance: 0,
    speed: 0,
    x: 0,
    hint: true,
    cycles: 0,
    map: activeMap,
    sections: 0,
};

export function seekDrive(distance: number): void {
    const rampDistance = (CRUISE * ACCEL_TIME) / 2;
    run.time =
        distance < rampDistance
            ? Math.sqrt((2 * ACCEL_TIME * distance) / CRUISE)
            : ACCEL_TIME + (distance - rampDistance) / CRUISE;
    run.distance = distance;
    run.speed = CRUISE * Math.min(1, run.time / ACCEL_TIME);
    run.cycles = Math.floor(distance / CIRCUIT_LENGTH);
}

export function advance(dt: number): void {
    const before = run.speed;
    run.time += dt;
    run.speed = CRUISE * Math.min(1, run.time / ACCEL_TIME);
    run.distance += (before + run.speed) * 0.5 * dt;
    run.cycles = Math.floor(run.distance / CIRCUIT_LENGTH);
}
export function steer(deltaPixels: number): number {
    const before = run.x;
    run.x = Math.max(
        -MAX_X,
        Math.min(MAX_X, before + (deltaPixels * (2 * MAX_X)) / (0.5 * game.screen.width)),
    );
    if (Math.abs(run.x - before) > 0.001) run.hint = false;
    return run.x - before;
}
export function openRoad() {
    Object.assign(run, {
        time: 0,
        distance: 0,
        speed: 0,
        x: 0,
        hint: true,
        cycles: 0,
        map: activeMap,
        sections: 0,
    });
    game.rig.pan = false;
    game.rig.drag = false;
    game.rig.pitch = CAMERA_PITCH;
    game.rig.yaw = Math.PI;
    game.rig.distance = CAMERA_DISTANCE;
    game.rig.focus(0, 1, -LOOK_AHEAD);
    const night = activeMap === 'night';
    const road = night ? buildNightCity() : buildHighway(),
        vehicle = spawnVehicle(night);
    let cameraX = 0,
        clock = 0;
    function draw(dt: number, lateralSpeed: number): void {
        clock += dt;
        const desired = run.x * 0.91;
        cameraX += (desired - cameraX) * (1 - Math.exp(-CAMERA_LAG * dt));
        // Keep the ship visible even when a pointer crosses the screen in one tick.
        cameraX = Math.max(run.x - 1.45, Math.min(run.x + 1.45, cameraX));
        game.rig.focus(cameraX, 1, -LOOK_AHEAD);
        if (night)
            game.rig.yaw =
                Math.PI + routeAt(run.distance + LOOK_AHEAD).heading - routeAt(run.distance).heading;
        run.sections = road(run.distance);
        vehicle(run.x, lateralSpeed, run.speed / CRUISE, clock, dt);
    }
    draw(0, 0);
    return draw;
}
