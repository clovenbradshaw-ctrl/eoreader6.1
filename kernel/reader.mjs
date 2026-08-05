// A sequential reader: processes a stream one WINDOW at a time (matching
// what the ground's statistic actually measures - windowMean, not a raw
// value), keeping a live ground, re-zeroing on surfeit. eoreader6's real
// ground()/difference()/reZero(), used live throughout.
import { ground, difference, reZero, isGap, windowMean } from "../../eoreader6/nul/index.js";

const SPEC = { draws: 200, window: 4, perturbation: "shuffle", statistic: "windowMean" };

export function makeReader({ received, seed = 0 } = {}) {
  if (!Array.isArray(received) || received.length < SPEC.window * 3) {
    throw new Error("a reader needs a received first ground - #1: the origin is a gift, not derived");
  }
  let material = [...received];
  let g = ground({ ...SPEC, material, seed });
  if (isGap(g)) throw new Error(`could not form an origin ground: ${g.gap}`);
  let rezeros = 0;
  let buffer = [];

  return {
    /** Feed one raw value. Returns null until a full window has accumulated, then a verdict. */
    read(value) {
      material = [...material, value];
      buffer.push(value);
      if (buffer.length < SPEC.window) return null;

      const observed = windowMean(buffer.slice(-SPEC.window), { window: SPEC.window });
      const d = difference(observed, g);
      const record = { window: buffer.slice(-SPEC.window), observed, verdict: isGap(d) ? d.gap : "placed", direction: isGap(d) ? d.direction : null, rank: isGap(d) ? null : d.rank, rezeroed: false };

      if (isGap(d) && d.gap === "exceeds_witness" && d.direction === "above") {
        const fresh = reZero(g, { material, seed: seed + rezeros + 1 });
        if (!isGap(fresh)) { g = fresh; rezeros += 1; record.rezeroed = true; }
      }
      buffer = [];
      return record;
    },
    state() {
      return { extent: material.length, rezeros, groundSupport: [g.samples[0], g.samples[g.samples.length - 1]] };
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stream = JSON.parse(process.argv[2]);
  const received = stream.slice(0, 16);
  const reader = makeReader({ received });
  const log = [];
  for (const v of stream.slice(16)) {
    const r = reader.read(v);
    if (r) log.push(r);
  }
  console.log(JSON.stringify({ log, final: reader.state() }, null, 2));
}
