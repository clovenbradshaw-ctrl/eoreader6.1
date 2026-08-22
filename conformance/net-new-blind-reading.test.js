import test from 'node:test';
import assert from 'node:assert/strict';
import { readExperienceStream } from '../packages/host/index.js';

const SPEC = { window:8, draws:32, reseeds:16, minArrivals:2 };
const e = value => ({ kind:'text', unit:'passage', value });

// Net-new sample written for this test after the canonical pipeline was fixed.
// It was not used to shape the implementation or the earlier semantic golden.
const events = [
  e('On the north pier, Sela inspected the beacon while Arun counted the ropes. Before sunset, Sela told Arun the beacon was working.\n\n'),
  e('During the night, Arun found Sela beside the beacon again. Sela repeated that the beacon was working, and Arun wrote the claim in his notebook.\n\n'),
  e('At sunrise, Arun opened the housing and found the lamp disconnected. Near him, Sela stared at the loose cable without speaking.\n\n'),
  e('Minutes later, Sela showed Arun a second lamp hidden below the pier. She explained that this lower lamp, not the disconnected upper lamp, had guided the boats all night.\n\n'),
];

const norm = x => String(x ?? '').toLowerCase();

test('net-new sample: one blind pipeline acquires beings and changes its reading only after disruptive evidence arrives', () => {
  const reading = readExperienceStream({ sourceId:'net-new-beacon', events, entitySpec:SPEC });
  assert.equal(reading.trajectory.length, 4);

  // Event 0: perception is not beinghood merely because names were extracted.
  const first = reading.trajectory[0];
  assert.ok(first.admission.candidates.some(c => (c.surfaces ?? []).some(s => /sela/i.test(s))), 'Sela should be perceived');
  assert.equal(first.admission.beings.length, 0, 'first encounter should not automatically mint beings');
  assert.equal(first.fold.cast.length, 0, 'candidate list must not masquerade as Fold cast');

  // Event 1: recurrence gives the causal admission machinery a chance to admit
  // Sela/Arun. We do not require every perceived noun (beacon, ropes, notebook)
  // to become a being.
  const second = reading.trajectory[1];
  const beings = second.admission.beings.flatMap(x => x.surfaces ?? []).map(norm);
  assert.ok(beings.some(x => x.includes('sela')), `Sela was never admitted; beings=${JSON.stringify(beings)}`);
  assert.ok(beings.some(x => x.includes('arun')), `Arun was never admitted; beings=${JSON.stringify(beings)}`);
  assert.ok(!beings.some(x => x === 'ropes' || x === 'notebook'), 'ordinary mentioned objects were promoted into cast beings');

  // Event 2 is the first evidence that attacks the repeated working-beacon
  // expectation. Structural change/surprise must not occur at event 1 because
  // of event 2, but must be available once event 2 has actually been Surfed.
  const beforeDisruption = reading.trajectory[1];
  const disruption = reading.trajectory[2];
  assert.ok(disruption.surf.value.includes('lamp disconnected'));
  assert.ok(disruption.delta.reorganized > 0 || disruption.fold.unresolved.length > 0,
    `disruptive evidence produced no Fold change: ${JSON.stringify({delta:disruption.delta, unresolved:disruption.fold.unresolved, links:disruption.fold.links})}`);

  // Event 3 changes scope rather than simply declaring the earlier experience
  // false: upper lamp disconnected, lower lamp functioning. The trajectory must
  // preserve both the disruption and subsequent differentiation/resolution.
  const resolution = reading.trajectory[3];
  assert.ok(resolution.surf.value.includes('second lamp'));
  assert.ok(resolution.delta.reorganized > 0 || resolution.fold.unresolved.length !== disruption.fold.unresolved.length,
    'scope-differentiating evidence produced no further experiential transformation');

  // Temporal horizon audit: every snapshot cursor is monotonic and exactly one
  // event is added at a time.
  for (let i=1; i<reading.trajectory.length; i++) {
    assert.equal(reading.trajectory[i].fold.cursor.event, i);
    assert.ok(reading.trajectory[i].surf.horizonByteEnd > reading.trajectory[i-1].surf.horizonByteEnd);
  }
  assert.equal(beforeDisruption.fold.cursor.event, 1);
});
