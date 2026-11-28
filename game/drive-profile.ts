export const CRUISE = 70;
export const ACCEL_TIME = 2;
export const CRAFT_BODY = { halfWidth: 1, halfLength: 4.13 / 2 };
export const SIDE_MARGIN = 0.30;
const EDGE_GEOMETRY_ALLOWANCE = 0.30;

export function craftLimit(roadWidth: number): number {
    return roadWidth / 2 - CRAFT_BODY.halfWidth - SIDE_MARGIN - EDGE_GEOMETRY_ALLOWANCE;
}

export function speedAt(time: number): number {
    return CRUISE * Math.min(1, time / ACCEL_TIME);
}

export function distanceAt(time: number): number {
    return time < ACCEL_TIME ? time * speedAt(time) / 2 : CRUISE * (time - ACCEL_TIME / 2);
}

export function timeAt(distance: number): number {
    const rampDistance = distanceAt(ACCEL_TIME);
    return distance < rampDistance
        ? Math.sqrt((2 * ACCEL_TIME * distance) / CRUISE)
        : ACCEL_TIME + (distance - rampDistance) / CRUISE;
}
