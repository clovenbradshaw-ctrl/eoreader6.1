import { receivedGround, applyObservation, applyDelta, deltaFold } from "../fold/index.js";
import { deriveOrientation } from "../orientation/index.js";
import { perceive as defaultPerceive } from "../perception/index.js";
import { witness as defaultWitness } from "../witness/index.js";
import { relevantNeighborhood, interrogateCube, deriveEOTransformations } from "../reasoning/fold-conditioned.js";
import { deriveSurprise, deriveTension, deriveRelease } from "../dynamics/index.js";

export function encounter(value) {
  return Object.freeze({ schema: "Encounter@1", ...value });
}

export function createRecursiveReader({ seed = {}, priors = [], perceivers = [], adapters = {} } = {}) {
  let fold = receivedGround(seed);
  const log = [];

  async function step(input) {
    const currentEncounter = input?.schema === "Encounter@1" ? input : encounter(input);
    const beforeFold = fold;
    const orientation = deriveOrientation(beforeFold);

    const candidates = await (adapters.perceive ?? defaultPerceive)(currentEncounter, orientation, {
      perceivers,
      priors: [...(orientation.receivedPriors ?? []), ...priors],
    });
    const observations = await (adapters.witness ?? defaultWitness)(currentEncounter, candidates, {
      admit: adapters.admit,
    });

    const neighborhood = (adapters.retrieve ?? relevantNeighborhood)(beforeFold, observations, {
      select: adapters.selectNeighborhood,
    });
    const interrogation = await (adapters.interrogate ?? interrogateCube)(observations, neighborhood, {
      ask: adapters.ask,
    });
    const delta = adapters.revise
      ? await adapters.revise({ observations, neighborhood, interrogation, fold: beforeFold })
      : deriveEOTransformations(interrogation, { id: `delta:${currentEncounter.sequencePosition ?? log.length}` });
    const canonicalDelta = delta?.schema === "DeltaFold@1" ? delta : deltaFold([]);

    log.push(currentEncounter, ...observations, canonicalDelta);
    let nextFold = beforeFold;
    for (const observation of observations) nextFold = applyObservation(nextFold, observation);
    nextFold = applyDelta(nextFold, canonicalDelta);
    fold = nextFold;

    return Object.freeze({
      encounter: currentEncounter,
      orientation,
      candidates,
      observations,
      relevantFold: neighborhood,
      interrogation,
      deltaFold: canonicalDelta,
      fold,
      surprise: deriveSurprise(canonicalDelta),
      tension: deriveTension(fold),
      release: deriveRelease(canonicalDelta, beforeFold, fold),
    });
  }

  async function read(encounters = []) {
    const turns = [];
    for (const item of encounters) turns.push(await step(item));
    return Object.freeze({ turns, fold, log: [...log] });
  }

  return Object.freeze({
    step,
    read,
    getFold: () => fold,
    getLog: () => [...log],
  });
}
