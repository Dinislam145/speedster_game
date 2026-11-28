import { ACCEL_TIME, CRAFT_BODY, CRUISE, SIDE_MARGIN, distanceAt } from './drive-profile.js';
import { NIGHT_PROFILE, ROAD_SAMPLE_STEP, routeHash } from './route.js';
import { LANES, safeAcross, type Lane, type safeRoute } from './safe-route.js';

const MIN_SPEED = 15;
const MAX_SPEED = 25;
const SLOT_LENGTH = 2;
const SLOT_MARGIN = 1;
const OCCUPANCY = 0.78;
const START_CLEARANCE = 8;
const SPAWN_LEAD = 200;
const MIN_CENTER_GAP = 5.5;
const LONG_MARGIN = 0.75;
const CURVE_ALLOWANCE = 0.50;
const LANE_JITTER = 0.20;

export const RETIRE_DISTANCE = 48;

export type TrafficBody = { key: string; halfWidth: number; halfLength: number };
type PlannedCar = {
    body: TrafficBody;
    lane: Lane;
    jitter: number;
    speed: number;
    launch: number;
    start: number;
};
type Encounter = { from: number; to: number };

export function positionAt(car: PlannedCar, time: number): number {
    return car.start + (time - car.launch) * car.speed;
}

function encounterReach(body: TrafficBody): number {
    return CRAFT_BODY.halfLength + Math.hypot(body.halfWidth, body.halfLength)
        + LONG_MARGIN + CURVE_ALLOWANCE;
}

function encounterAt(car: PlannedCar): Encounter {
    const reach = encounterReach(car.body);
    const intercept = positionAt(car, 0);
    const acceleration = CRUISE / ACCEL_TIME;
    const atCruise = distanceAt(ACCEL_TIME) - car.speed * ACCEL_TIME;
    // Solve player distance − NPC travel from its extrapolated origin on the closing branch.
    const crossing = (target: number) => target <= atCruise
        ? (car.speed + Math.sqrt(car.speed ** 2 + 2 * acceleration * target)) / acceleration
        : (target + distanceAt(ACCEL_TIME)) / (CRUISE - car.speed);
    const from = car.start - distanceAt(car.launch) <= reach ? car.launch : crossing(intercept - reach);
    return { from, to: crossing(intercept + reach) };
}

function lateralReach(body: TrafficBody, maxLaneWidth: number): number {
    const reach = encounterReach(body);
    const turn = reach / Math.min(...NIGHT_PROFILE.radius);
    const drift = turn * (reach / 2 + ROAD_SAMPLE_STEP);
    const outerOffset = maxLaneWidth + LANE_JITTER;
    return CRAFT_BODY.halfWidth + body.halfWidth + SIDE_MARGIN + drift
        + outerOffset * (1 - Math.cos(turn)) + body.halfLength * Math.sin(turn);
}

export function planTraffic(seed: number, bodies: readonly TrafficBody[],
    route: ReturnType<typeof safeRoute>, laneWidth: number, maxLaneWidth: number,
) {
    const lateralReaches = bodies.map(body => lateralReach(body, maxLaneWidth));
    const planned = new Map<number, PlannedCar>();
    const lastInLane: (PlannedCar | undefined)[] = [];
    let nextSlot = 0;
    let previousTime = -Infinity;

    return (time: number): ReadonlyMap<number, PlannedCar> => {
        if (time < previousTime) {
            planned.clear();
            lastInLane.length = 0;
            nextSlot = 0;
        }
        previousTime = time;

        // Invert the fastest possible trajectory to discard slots that cannot be on screen.
        const from = distanceAt(time) - RETIRE_DISTANCE;
        const fraction = MAX_SPEED / CRUISE;
        const earliest = (from - time * MAX_SPEED - SPAWN_LEAD * fraction) / (1 - fraction);
        const firstSlot = Math.floor(Math.max(0, earliest - START_CLEARANCE) / SLOT_LENGTH);
        for (const slot of planned.keys()) {
            if (slot >= firstSlot) break;
            planned.delete(slot);
        }

        const spawnThrough = SPAWN_LEAD + time * CRUISE;
        while (START_CLEARANCE + nextSlot * SLOT_LENGTH <= spawnThrough) {
            const slot = nextSlot;
            const hash = routeHash(seed ^ Math.imul(slot, 0x9e3779b9));
            const sample = (channel: number) => routeHash(hash ^ channel) / 0x100000000;
            const start = START_CLEARANCE + slot * SLOT_LENGTH + sample(2) * (SLOT_LENGTH - 2 * SLOT_MARGIN);
            if (start > spawnThrough) break;
            nextSlot++;
            if (!bodies.length || (slot !== 0 && sample(1) >= OCCUPANCY)) continue;

            const launch = Math.max(0, (start - SPAWN_LEAD) / CRUISE);
            const laneIndex = Math.floor(sample(4) * LANES.length);
            const bodyIndex = Math.floor(sample(3) * bodies.length);
            const body = bodies[bodyIndex];
            const follower = lastInLane[laneIndex];
            let lowerSpeed = MIN_SPEED;
            if (follower) {
                const gap = Math.max(MIN_CENTER_GAP, body.halfLength + follower.body.halfLength + LONG_MARGIN);
                // At this time a follower that closes to the minimum gap leaves both cars behind the
                // retirement boundary. For the current drive profile this is always after acceleration.
                const safeTime = (positionAt(follower, 0) + CRUISE * ACCEL_TIME / 2 + RETIRE_DISTANCE + gap)
                    / (CRUISE - follower.speed);
                const timeLeft = safeTime - launch;
                if (timeLeft > 0) {
                    const spareGap = start - positionAt(follower, launch) - gap;
                    if (spareGap < 0) continue;
                    lowerSpeed = Math.max(MIN_SPEED, Math.ceil(follower.speed - spareGap / timeLeft));
                }
            }
            const car = {
                body, launch, start, lane: LANES[laneIndex],
                speed: lowerSpeed + Math.floor(sample(6) * (MAX_SPEED - lowerSpeed + 1)),
                jitter: (2 * sample(5) - 1) * LANE_JITTER,
            };
            const encounter = encounterAt(car);
            const from = distanceAt(encounter.from);
            const to = distanceAt(encounter.to);
            const nearX = car.lane * laneWidth + car.jitter;
            const farX = car.lane * maxLaneWidth + car.jitter;
            const left = Math.min(nearX, farX) - lateralReaches[bodyIndex];
            const right = Math.max(nearX, farX) + lateralReaches[bodyIndex];
            // The route centre moves linearly across each piece. Its two clipped endpoints
            // bound the whole manoeuvre while the two vehicles are alongside each other.
            const intersects = route(from, to).some(segment => {
                const first = safeAcross(segment, Math.max(segment.from, from), laneWidth);
                const last = safeAcross(segment, Math.min(segment.to, to), laneWidth);
                return Math.min(first, last) <= right && Math.max(first, last) >= left;
            });
            if (intersects) continue;

            lastInLane[laneIndex] = car;
            if (slot >= firstSlot) planned.set(slot, car);
        }
        return planned;
    };
}
