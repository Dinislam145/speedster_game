import { game } from './engine.js';
import { buildHighway, ROAD_WIDTH, CIRCUIT_LENGTH } from './highway.js';
import { spawnVehicle, CRAFT_WIDTH } from './vehicle.js';
import { buildNightCity } from './night-city.js';
import {
    makeRoute,
    CAMERA_LOOK_AHEAD,
    FRAGMENT_LENGTH,
    NIGHT_PROFILE,
    type NightRoute,
    type RouteMode,
} from './route.js';

export type CityMap = 'night' | 'day';
export let activeMap: CityMap = 'night';
export function selectMap(map: CityMap): void {
    activeMap = map;
}

export const CRUISE = 40;
const ACCEL_TIME = 2;
const CAMERA_DISTANCE = 20.5,
    CAMERA_PITCH = 0.215,
    CAMERA_LAG = 10;
let seed: number | undefined;
let mode: RouteMode = 'random';
let activeRoute: NightRoute | undefined;

export function selectNightRoute(nextSeed: number, nextMode: RouteMode): void {
    seed = nextSeed;
    mode = nextMode;
    selectMap('night');
}

export function roadCheckpoint(name: string): number | undefined {
    if (activeRoute) return activeRoute.checkpoint(name);
    const day = { shop: 34, right: 96, left: 280, wrap: 311.3 };
    return day[name as keyof typeof day];
}

export const run = {
    time: 0,
    distance: 0,
    speed: 0,
    x: 0,
    hint: true,
    cycles: 0,
    map: activeMap,
    sections: 0,
    seed: null as number | null,
    mode: null as RouteMode | null,
    section: null as number | null,
    angle: 0,
    width: ROAD_WIDTH,
    fragments: 0,
    objects: 0,
    allocated: 0,
    meshSlots: 0,
    loaded: 0,
    retired: 0,
    windowLights: 0,
    preparedThrough: 0,
    generated: 0,
    fallbacks: 0,
};

export function seekDrive(distance: number): void {
    const rampDistance = (CRUISE * ACCEL_TIME) / 2;
    run.time =
        distance < rampDistance
            ? Math.sqrt((2 * ACCEL_TIME * distance) / CRUISE)
            : ACCEL_TIME + (distance - rampDistance) / CRUISE;
    run.distance = distance;
    run.speed = CRUISE * Math.min(1, run.time / ACCEL_TIME);
    run.cycles = activeRoute ? 0 : Math.floor(distance / CIRCUIT_LENGTH);
}

export function advance(dt: number): void {
    const before = run.speed;
    run.time += dt;
    run.speed = CRUISE * Math.min(1, run.time / ACCEL_TIME);
    run.distance += (before + run.speed) * 0.5 * dt;
    run.cycles = activeRoute ? 0 : Math.floor(run.distance / CIRCUIT_LENGTH);
}
export function steer(deltaPixels: number): number {
    const before = run.x;
    const half = (run.width - CRAFT_WIDTH) / 2;
    const dx = (deltaPixels * (ROAD_WIDTH - CRAFT_WIDTH)) / (0.5 * game.screen.width);
    run.x = Math.max(-half, Math.min(half, before + dx));
    if (Math.abs(run.x - before) > 0.001) run.hint = false;
    return run.x - before;
}
export function openRoad() {
    const night = activeMap === 'night';
    if (night && seed === undefined) seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const route = night ? makeRoute(seed!, mode) : undefined;
    activeRoute = route;
    Object.assign(run, {
        time: 0,
        distance: 0,
        speed: 0,
        x: 0,
        hint: true,
        cycles: 0,
        map: activeMap,
        sections: 0,
        seed: night ? seed : null,
        mode: night ? mode : null,
        section: null,
        angle: 0,
        width: ROAD_WIDTH,
        fragments: 0,
        objects: 0,
        allocated: 0,
        meshSlots: 0,
        loaded: 0,
        retired: 0,
        windowLights: 0,
        preparedThrough: 0,
        generated: 0,
        fallbacks: 0,
    });
    game.rig.pan = false;
    game.rig.drag = false;
    game.rig.pitch = CAMERA_PITCH;
    game.rig.yaw = Math.PI;
    game.rig.distance = CAMERA_DISTANCE;
    game.rig.focus(0, 1, -CAMERA_LOOK_AHEAD);
    const drawNight = route ? buildNightCity(route) : undefined;
    const drawDay = night ? undefined : buildHighway();
    const vehicle = spawnVehicle(night);
    let cameraX = 0,
        clock = 0;
    function draw(dt: number, lateralSpeed: number): void {
        clock += dt;
        if (drawNight && route) {
            // Prime the route on entry and after a debug seek, before the camera or
            // the streamed meshes query the target distance.
            const from =
                Math.floor((run.distance - NIGHT_PROFILE.behind) / FRAGMENT_LENGTH) * FRAGMENT_LENGTH;
            route.cover(from, run.distance + CAMERA_LOOK_AHEAD);
            const here = route.sampleRoad(run.distance);
            const ahead = route.sampleRoad(run.distance + CAMERA_LOOK_AHEAD);
            run.width = here.width;
            run.section = here.sectionId;
            run.angle = (route.sectionFor(run.distance).road.angle * 180) / Math.PI;
            game.rig.yaw = Math.PI + ahead.heading - here.heading;
        } else if (drawDay) run.sections = drawDay(run.distance);
        const half = (run.width - CRAFT_WIDTH) / 2;
        run.x = Math.max(-half, Math.min(half, run.x));
        const desired = run.x * 0.91;
        cameraX += (desired - cameraX) * (1 - Math.exp(-CAMERA_LAG * dt));
        // Keep the ship visible even when a pointer crosses the screen in one tick.
        cameraX = Math.max(run.x - 1.45, Math.min(run.x + 1.45, cameraX));
        game.rig.focus(cameraX, 1, -CAMERA_LOOK_AHEAD);
        if (drawNight && route) {
            Object.assign(run, drawNight(run.distance));
            run.generated = route.created;
            run.fallbacks = route.fallbacks;
        }
        vehicle(run.x, lateralSpeed, run.speed / CRUISE, clock, dt);
    }
    draw(0, 0);
    return draw;
}
