import test from 'node:test';
import assert from 'node:assert/strict';
import { readExperienceStream } from '../packages/host/index.js';

const SPEC = { window:8, draws:32, reseeds:16, minArrivals:2 };
const e = value => ({ kind:'text', unit:'passage', value });

const events = [
  e('On the north pier, Sela inspected the beacon while Arun counted the ropes. Before sunset, Sela told Arun the beacon was working.\n\n'),
  e('During the night, Arun found Sela beside the beacon again. Sela repeated that the beacon was working, and Arun wrote the claim in his notebook.\n\n'),
  e('At sunrise, Arun opened the housing and found the lamp disconnected. Near him, Sela stared at the loose cable without speaking.\n\n'),
  e('Minutes later, Sela showed Arun a second lamp hidden below the pier. She explained that this lower lamp, not the disconnected upper lamp, had guided the boats all night.\n\n'),
];

const norm = x => String(x ?? '').toLowerCase();

test('net-new sample: one blind pipeline builds and revises a provisional understanding without fabricating cast', () => {
  const reading = readExperienceStream({ sourceId:'net-new-beacon', events, entitySpec:SPEC, language:'en' });
  assert.equal(reading.trajectory.length, 4);

  const first = reading.trajectory[0];
  assert.ok(first.admission.candidates.some(c => (c.surfaces ?? []).some(s => /sela/i.test(s))), 'Sela should be perceived');
  assert.equal(first.admission.beings.length, 0, 'first encounter should not automatically mint beings');
  assert.equal(first.fold.cast.length, 0, 'candidate list must not masquerade as Fold cast');

  const second = reading.trajectory[1];
  const beings = second.admission.beings.flatMap(x => x.surfaces ?? []).map(norm);
  const provisional = second.fold.provisional.entities.map(x => norm(x.display));
  const refusalSurfaces = second.admission.refusals.map(x => norm(x.surface));
  for (const name of ['sela', 'arun']) {
    assert.ok(provisional.some(x => x === name), `${name} disappeared before provisional ontology`);
    assert.ok(
      beings.some(x => x.includes(name)) || refusalSurfaces.includes(name),
      `${name} is neither admitted nor explicitly refused`,
    );
  }
  assert.ok(!beings.some(x => x === 'ropes' || x === 'notebook'), 'ordinary mentioned objects were promoted into settled beings');
  assert.ok(second.fold.provisional.links.length > 0, 'recurring experience produced no tentative relational meaning');

  const disruption = reading.trajectory[2];
  assert.ok(disruption.surf.value.includes('lamp disconnected'));
  assert.ok(disruption.surprise.reorganized > 0,
    `disruptive evidence produced no Fold reorganization: ${JSON.stringify(disruption.surprise)}`);
  assert.ok(disruption.surprise.transformations.relationAdmissions.length > 0,
    'disruptive Surf produced no tentative relation to reason over');

  const resolution = reading.trajectory[3];
  assert.ok(resolution.surf.value.includes('second lamp'));
  assert.ok(resolution.surprise.reorganized > 0, 'scope-differentiating evidence produced no further transformation');

  for (let i=1; i<reading.trajectory.length; i++) {
    assert.equal(reading.trajectory[i].fold.cursor.event, i);
    assert.ok(reading.trajectory[i].surf.horizonByteEnd > reading.trajectory[i-1].surf.horizonByteEnd);
  }
});
