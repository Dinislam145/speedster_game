import { game } from './engine.js';

// Anchor each new press at its own down position. Consume motion even at the
// guardrail, so the first pixel back towards the road always moves the craft.
export function dragReader() {
    let active: number | null = null,
        previous = 0;
    return () => {
        const p = game.input.pointer;
        if (!p || (!p.down && !p.released) || p.button > 0) {
            active = null;
            return 0;
        }
        if (active !== p.id || p.pressed) previous = p.startX;
        const dx = p.x - previous;
        active = p.down ? p.id : null;
        previous = p.x;
        return dx;
    };
}
