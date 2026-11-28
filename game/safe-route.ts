import { CRAFT_BODY } from './drive-profile.js';
import { routeHash } from './route.js';

export const LANES = [-1, 0, 1] as const;
export type Lane = (typeof LANES)[number];

const MIN_RUN = 5;
const MAX_RUN = 50;
const CHANGE_LENGTH = 1.5 * (2 * CRAFT_BODY.halfLength);

export type SafeSegment = { from: number; to: number; lane: Lane; nextLane: Lane };

export function safeRoute(seed: number) {
    const segments: SafeSegment[] = [];
    let lane: Lane = 0;
    let distance = 0;

    return (from: number, to: number): SafeSegment[] => {
        while (distance <= to) {
            const hash = routeHash(seed ^ Math.imul(segments.length / 2 + 1, 0x7feb352d));
            const end = distance + MIN_RUN + hash % (MAX_RUN - MIN_RUN + 1);
            const outerLane = (hash >>> 16) % 2 === 0 ? -1 : 1;
            const nextLane = lane === 0 ? outerLane : 0;
            segments.push(
                { from: distance, to: end, lane, nextLane: lane },
                { from: end, to: end + CHANGE_LENGTH, lane, nextLane },
            );
            distance = end + CHANGE_LENGTH;
            lane = nextLane;
        }
        let first = 0;
        let last = segments.length;
        while (first < last) {
            const middle = (first + last) >>> 1;
            if (segments[middle].to < from) first = middle + 1;
            else last = middle;
        }
        const result: SafeSegment[] = [];
        for (let index = first; index < segments.length && segments[index].from <= to; index++) {
            result.push(segments[index]);
        }
        return result;
    };
}

export function safeAcross(segment: SafeSegment, distance: number, laneWidth: number): number {
    const progress = (distance - segment.from) / (segment.to - segment.from);
    return laneWidth * (segment.lane + (segment.nextLane - segment.lane) * progress);
}
