// Arc length in metres. The repeating route has a continuous tangent and zero
// curvature at both ends. Positive heading turns towards the driver's right.
const PERIOD = 408;
export const RIGHT_ENTRY = 96;
const LEFT_ENTRY = 224;
export const LEFT_MIDDLE = LEFT_ENTRY + 56;
const BLEND = 24;
const RIGHT_LENGTH = 96;
const LEFT_LENGTH = 112;
const TURN = (RIGHT_LENGTH - BLEND) / 200;

function turnFraction(s: number, length: number): number {
    if (s <= 0) return 0;
    if (s >= length) return 1;
    const ramp = (v: number) => (v - (BLEND / Math.PI) * Math.sin((Math.PI * v) / BLEND)) / 2;
    const area = length - BLEND;
    if (s < BLEND) return ramp(s) / area;
    if (s > length - BLEND) return 1 - ramp(length - s) / area;
    return (s - BLEND / 2) / area;
}

function angle(s: number): number {
    return TURN * (turnFraction(s - RIGHT_ENTRY, RIGHT_LENGTH) - turnFraction(s - LEFT_ENTRY, LEFT_LENGTH));
}

// Integrate once at one-metre intervals. Interpolation uses the actual tangent
// at both ends, including the last metre across the repeat.
const samples = [{ x: 0, z: 0 }];
for (let i = 0; i < PERIOD; i++) {
    const a = angle(i + 0.5);
    samples.push({ x: samples[i].x + Math.sin(a), z: samples[i].z - Math.cos(a) });
}
export function routeAt(distance: number) {
    const lap = Math.floor(distance / PERIOD);
    const s = distance - lap * PERIOD;
    const i = Math.floor(s),
        t = s - i;
    const a = angle(s),
        mid = angle(i + t / 2);
    return {
        x: lap * samples[PERIOD].x + samples[i].x + t * Math.sin(mid),
        z: lap * samples[PERIOD].z + samples[i].z - t * Math.cos(mid),
        heading: a,
        sin: Math.sin(a),
        cos: Math.cos(a),
    };
}
