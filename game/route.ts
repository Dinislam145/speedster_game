export const FRAGMENT_LENGTH = 24;
export const CAMERA_LOOK_AHEAD = 9.1;
export const NIGHT_PROFILE = {
    widths: [10, 12, 14],
    startWidth: 12,
    // Only used by the old mixed layout: with SINGLE_LEFT_TURN on, the road
    // starts bending 20° left from the start line, with no straight at all.
    startStraight: 96,
    widthBlend: 48,
    curveBlend: 24,
    radius: [180, 260],
    straightLength: [48, 144],
    normalAngle: [15, 55],
    longAngle: [60, 135],
    straightChance: 0.35,
    longChance: 0.1,
    attempts: 8,
    // A forward-progress envelope still admits a full 135° turn. It puts a
    // finite bound on which earlier sections can intersect a new candidate.
    headingLimit: (80 * Math.PI) / 180,
    corridorHalfWidth: 72,
    collisionStep: 8,
    adjacentDistance: 176,
    forward: 240,
    behind: 48,
    fogEnd: 320,
};

const TAU = Math.PI * 2;
const RADIANS = TAU / 360;
export const ROAD_SAMPLE_STEP = 2;
const DISTRICTS = ['retail', 'residential', 'industrial'] as const;
const CLEARANCE = NIGHT_PROFILE.corridorHalfWidth * 2 + NIGHT_PROFILE.collisionStep;
const MIN_PROGRESS = Math.cos(NIGHT_PROFILE.headingLimit);
// In this distance the route advances farther along its main axis than two
// corridors can reach. The checked straight also guarantees a fallback.
const ESCAPE = Math.ceil(CLEARANCE / MIN_PROGRESS) + 2 * NIGHT_PROFILE.collisionStep;
const HISTORY = ESCAPE + NIGHT_PROFILE.fogEnd + NIGHT_PROFILE.corridorHalfWidth;

export type District = (typeof DISTRICTS)[number];
export type RouteMode = 'random' | 'control';
type Point = { x: number; z: number };
type Pose = Point & { heading: number };
type FootprintPoint = Point & { distance: number };
export type RoadSample = Pose & { sin: number; cos: number; width: number; sectionId: number };
export type RoadSection = {
    readonly id: number;
    readonly start: number;
    readonly end: number;
    readonly origin: Pose;
    readonly road: {
        readonly length: number;
        readonly angle: number;
        readonly radius: number;
        /** Metres eased at each end of the bend; 0 keeps the curvature constant. */
        readonly blend: number;
        readonly widthStart: number;
        readonly widthEnd: number;
        readonly surface: District;
    };
    readonly environment: { readonly district: District; readonly seed: number; readonly remaining: number };
    readonly long: boolean;
    readonly points: readonly Point[];
};
type RoadChoice = {
    length: number;
    angle: number;
    radius: number;
    width: number;
    long: boolean;
    blend: number;
};

export function routeHash(value: number): number {
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
}

function headingAt(section: RoadSection, offset: number): number {
    const { angle, radius, length, blend } = section.road;
    if (angle === 0 || offset <= 0) return section.origin.heading;
    if (offset >= length) return section.origin.heading + angle;
    // No easing: the bend keeps the same curvature from the first metre to the
    // last, so consecutive sections join into one unbroken turn.
    if (blend <= 0) return section.origin.heading + (Math.sign(angle) * offset) / radius;
    const ramp = (s: number) => (s - (blend / Math.PI) * Math.sin((Math.PI * s) / blend)) / 2;
    const distance =
        offset < blend
            ? ramp(offset)
            : offset > length - blend
              ? length - blend - ramp(length - offset)
              : offset - blend / 2;
    return section.origin.heading + (Math.sign(angle) * distance) / radius;
}

function sectionAt(
    id: number,
    start: number,
    origin: Pose,
    widthStart: number,
    choice: RoadChoice,
    environment: RoadSection['environment'],
): RoadSection {
    const points: Point[] = [{ x: origin.x, z: origin.z }];
    const section: RoadSection = {
        id,
        start,
        end: start + choice.length,
        origin,
        long: choice.long,
        environment,
        points,
        road: {
            length: choice.length,
            angle: choice.angle,
            radius: choice.radius,
            blend: choice.blend,
            widthStart,
            widthEnd: choice.width,
            surface: environment.district,
        },
    };
    for (let from = 0; from < choice.length; from += ROAD_SAMPLE_STEP) {
        const step = Math.min(ROAD_SAMPLE_STEP, choice.length - from);
        const heading = headingAt(section, from + step / 2);
        const previous = points[points.length - 1];
        points.push({ x: previous.x + Math.sin(heading) * step, z: previous.z - Math.cos(heading) * step });
    }
    return section;
}

export function sampleSection(section: RoadSection, distance: number): RoadSample {
    const offset = Math.max(0, Math.min(section.road.length, distance - section.start));
    const index = Math.floor(offset / ROAD_SAMPLE_STEP);
    const remainder = offset - index * ROAD_SAMPLE_STEP;
    const { x, z } = section.points[index];
    const heading = headingAt(section, offset);
    const mid = headingAt(section, offset - remainder / 2);
    const blend = Math.min(1, offset / NIGHT_PROFILE.widthBlend);
    const eased = blend * blend * (3 - 2 * blend);
    return {
        x: x + Math.sin(mid) * remainder,
        z: z - Math.cos(mid) * remainder,
        heading,
        sin: Math.sin(heading),
        cos: Math.cos(heading),
        sectionId: section.id,
        width: section.road.widthStart + (section.road.widthEnd - section.road.widthStart) * eased,
    };
}

function straight(length: number, width: number): RoadChoice {
    return { length, width, angle: 0, radius: 0, long: false, blend: 0 };
}

function curve(degrees: number, radius: number, width: number, long = false,
    blend = NIGHT_PROFILE.curveBlend): RoadChoice {
    const angle = degrees * RADIANS;
    return { length: Math.abs(angle) * radius + blend, width, angle, radius, long, blend };
}

const CONTROL_CHOICES = [
    straight(96, 12),
    curve(67.5, 220, 14),
    straight(72, 10),
    curve(-135, 220, 10, true),
    straight(96, 12),
    curve(135, 220, 12, true),
    straight(96, 14),
];

// The map is ONE manoeuvre, repeated: a left-hand bend of exactly 20° from
// straight ahead. There are no straights and no right-handers, so a section's
// shape is the same everywhere and only its width and radius vary with the seed.
// A negative angle is a left turn in this codebase (heading grows to the right).
// Turn the flag off to get the old mix of straights and seeded angles back.
const SINGLE_LEFT_TURN = true;
const TURN_LEFT_DEGREES = -20;

const CONTROL_POINTS = {
    narrow: CONTROL_CHOICES[0].length + CONTROL_CHOICES[1].length,
    left135:
        CONTROL_CHOICES.slice(0, 3).reduce((total, road) => total + road.length, 0) +
        CONTROL_CHOICES[3].length / 2,
    right135:
        CONTROL_CHOICES.slice(0, 5).reduce((total, road) => total + road.length, 0) +
        CONTROL_CHOICES[5].length / 2,
};

export function makeRoute(seed: number, mode: RouteMode) {
    let sections: RoadSection[] = [];
    let footprint: FootprintPoint[] = [];
    let maxCreated = 0;
    let fallbackCount = 0;
    const leadIn = sectionAt(
        -1,
        -NIGHT_PROFILE.behind,
        { x: 0, z: NIGHT_PROFILE.behind, heading: 0 },
        NIGHT_PROFILE.startWidth,
        straight(NIGHT_PROFILE.behind, NIGHT_PROFILE.startWidth),
        { district: 'retail', seed: routeHash(seed ^ 0x3c6ef372), remaining: 1 },
    );

    function environmentAt(id: number, previous?: RoadSection): RoadSection['environment'] {
        const value = routeHash(seed ^ Math.imul(id + 1, 0x6d2b79f5));
        if (id === 0) return { district: 'retail', seed: value, remaining: 2 + (value % 3) };
        if (previous && previous.environment.remaining > 1)
            return {
                district: previous.environment.district,
                seed: value,
                remaining: previous.environment.remaining - 1,
            };
        const alternatives = DISTRICTS.filter((district) => district !== previous?.environment.district);
        return {
            district: alternatives[value % alternatives.length],
            seed: value,
            remaining: 2 + ((value >>> 8) % 3),
        };
    }

    function validate(candidate: RoadSection, end: RoadSample, samples: FootprintPoint[]): boolean {
        if (Math.abs(end.heading) > NIGHT_PROFILE.headingLimit) return false;
        const clearanceSquared = CLEARANCE * CLEARANCE;

        function clear(point: FootprintPoint, others: FootprintPoint[]): boolean {
            return !others.some(
                (past) =>
                    point.distance - past.distance >= NIGHT_PROFILE.adjacentDistance &&
                    (point.x - past.x) ** 2 + (point.z - past.z) ** 2 < clearanceSquared,
            );
        }

        for (const p of samples) if (!clear(p, footprint) || !clear(p, samples)) return false;
        // Check a straight escape before committing any turn. Sample on the global
        // lattice so a fallback covers exactly the same points on a later update.
        const first = Math.ceil(candidate.end / NIGHT_PROFILE.collisionStep) * NIGHT_PROFILE.collisionStep;
        for (
            let distance = first;
            distance <= candidate.end + ESCAPE;
            distance += NIGHT_PROFILE.collisionStep
        ) {
            const offset = distance - candidate.end;
            const p = { distance, x: end.x + end.sin * offset, z: end.z - end.cos * offset };
            if (!clear(p, footprint) || !clear(p, samples)) return false;
        }
        return true;
    }

    function extend(): void {
        const previous = sections.at(-1);
        const id = previous ? previous.id + 1 : 0;
        const start = previous?.end ?? 0;
        const origin = previous ? sampleSection(previous, start) : { x: 0, z: 0, heading: 0 };
        const width = previous?.road.widthEnd ?? NIGHT_PROFILE.startWidth;
        const environment = environmentAt(id, previous);
        const planned = mode === 'control' ? CONTROL_CHOICES[id] : undefined;
        // A fixed left turn never stops turning, so its heading passes the 80°
        // limit by design and it closes a lap after 360°. Both are fine: the
        // streaming window covers only a fraction of a lap.
        const fixed = mode === 'random' && SINGLE_LEFT_TURN;

        function pointsFor(section: RoadSection): FootprintPoint[] {
            const points: FootprintPoint[] = [];
            const step = NIGHT_PROFILE.collisionStep;
            for (
                let distance = Math.ceil(section.start / step) * step;
                distance < section.end;
                distance += step
            )
                points.push({ ...sampleSection(section, distance), distance });
            return points;
        }

        function commit(section: RoadSection, samples: FootprintPoint[]): void {
            footprint.push(...samples);
            footprint = footprint.filter((point) => point.distance >= section.end - HISTORY);
            sections.push(section);
            maxCreated = Math.max(maxCreated, id + 1);
        }

        for (let attempt = 0; attempt < NIGHT_PROFILE.attempts; attempt++) {
            let state = routeHash(seed ^ Math.imul(id + 1, 0x9e3779b9) ^ Math.imul(attempt + 1, 0x85ebca6b));
            const next = () => {
                state = routeHash(state + 0x9e3779b9);
                return state / 0x100000000;
            };
            const between = ([lo, hi]: number[]) => lo + (hi - lo) * next();
            const roll = next();
            const targetWidth = NIGHT_PROFILE.widths[Math.floor(next() * NIGHT_PROFILE.widths.length)];
            const isLong = roll >= 1 - NIGHT_PROFILE.longChance;
            const choice =
                planned ??
                (SINGLE_LEFT_TURN
                    ? curve(TURN_LEFT_DEGREES, between(NIGHT_PROFILE.radius), targetWidth, false, 0)
                    : previous?.long || roll < NIGHT_PROFILE.straightChance
                      ? straight(Math.round(between(NIGHT_PROFILE.straightLength)), targetWidth)
                      : curve(
                            (next() < 0.5 ? -1 : 1) *
                                between(isLong ? NIGHT_PROFILE.longAngle : NIGHT_PROFILE.normalAngle),
                            between(NIGHT_PROFILE.radius),
                            targetWidth,
                            isLong,
                        ));
            const candidate = sectionAt(id, start, origin, width, choice, environment);
            const samples = pointsFor(candidate);
            if (planned || fixed || validate(candidate, sampleSection(candidate, candidate.end), samples)) {
                commit(candidate, samples);
                return;
            }
        }
        // The previous accepted section reserved this ray through the entire
        // clearance zone. Continuing along it cannot change the visible route.
        const fallback = sectionAt(id, start, origin, width, straight(96, width), environment);
        commit(fallback, pointsFor(fallback));
        fallbackCount++;
    }

    function cover(from: number, through: number): void {
        if (sections.length && from < sections[0].start && sections[0].id !== 0) {
            sections = [];
            footprint = [];
            fallbackCount = 0;
        }
        while (!sections.length || sections[sections.length - 1].end <= through) {
            extend();
            while (sections.length > 1 && sections[0].end <= from) sections.shift();
        }
    }

    function sectionFor(distance: number): RoadSection {
        if (distance < 0) return leadIn;
        const section = sections.find((item) => item.start <= distance && distance < item.end);
        if (!section) throw new RangeError('Road has not been prepared for ' + distance + ' m');
        return section;
    }

    return {
        cover,
        sectionFor,
        sampleRoad: (distance: number) => sampleSection(sectionFor(distance), distance),
        get created() {
            return maxCreated;
        },
        get fallbacks() {
            return fallbackCount;
        },
        checkpoint(name: string): number | undefined {
            if (name === 'shop') return 34;
            if (name === 'right') return 96;
            if (name === 'wrap') return NIGHT_PROFILE.behind + FRAGMENT_LENGTH - 1;
            if (mode === 'control' && Object.hasOwn(CONTROL_POINTS, name))
                return CONTROL_POINTS[name as keyof typeof CONTROL_POINTS];
            if (name === 'left') {
                // Use the actual route, including the already planned right turn.
                for (let distance = 96; distance < 8000; ) {
                    cover(distance, distance);
                    const section = sectionFor(distance);
                    if (section.road.angle < 0) return (section.start + section.end) / 2;
                    distance = section.end;
                }
            }
            return undefined;
        },
    };
}

export type NightRoute = ReturnType<typeof makeRoute>;
