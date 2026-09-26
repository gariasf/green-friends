import { File } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';

import speciesIndex from '@/assets/species-index.json';
import {
  suggestSpecies,
  type Confidence,
  type IdentifyCandidate,
  type IdentifyRelay,
  type SpeciesIndex,
} from '@/src/core/identify';
import { getSpecies, type Species } from '@/src/core/species';
import { RELAY_URL } from '@/src/core/sync';
import { db } from '@/src/db/client';
import { prepare } from '@/src/ui/Photo';

/** The long edge of the photo Identify sends, in pixels (ADR-0007). */
const IDENTIFY_LONG_EDGE = 1280;

/** Why Identify didn't work, in the words New plant shows inline. */
const FAILURE = {
  offline: 'Identify needs a connection.',
  unavailable: "Identify isn't available right now. Try again tomorrow.",
  failed: "Identify didn't work. Try again later.",
};

class IdentifyError extends Error {
  constructor(readonly kind: keyof typeof FAILURE) {
    super(FAILURE[kind]);
  }
}

/** The relay's `POST /identify` (docs/agents/relay.md), over fetch. */
const relay: IdentifyRelay = {
  async identify(jpeg) {
    let response: Response;
    try {
      response = await fetch(`${RELAY_URL}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: jpeg as Uint8Array<ArrayBuffer>,
      });
    } catch {
      // fetch throws only when no answer came: offline, or the network failed on the way.
      throw new IdentifyError('offline');
    }
    if (response.status === 429) throw new IdentifyError('unavailable');
    if (!response.ok) throw new IdentifyError('failed');
    return (await response.json()) as IdentifyCandidate[];
  },
};

export type IdentifyState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'suggestions'; suggestions: { species: Species; confidence: Confidence }[] }
  | { kind: 'failed'; message: string };

/**
 * Identify for New plant: `run` sends the prepared photo through the relay, only when the user taps
 * for it, and turns the candidates into Suggestions; `clear` forgets them, and any answer still on
 * its way, as when the photo changes.
 */
export function useIdentify() {
  const [state, setState] = useState<IdentifyState>({ kind: 'idle' });
  // Each run's number; an answer for an older one (the photo since replaced) is dropped.
  const latest = useRef(0);

  const run = useCallback(async (prepared: string) => {
    const mine = ++latest.current;
    setState({ kind: 'running' });
    let next: IdentifyState;
    try {
      const candidates = await relay.identify(await shrink(prepared));
      const suggestions = suggestSpecies(candidates, speciesIndex as SpeciesIndex).flatMap(
        ({ speciesId, confidence }) => {
          const species = getSpecies(db, speciesId);
          return species ? [{ species, confidence }] : [];
        },
      );
      next = { kind: 'suggestions', suggestions };
    } catch (error) {
      next = {
        kind: 'failed',
        message: error instanceof IdentifyError ? error.message : FAILURE.failed,
      };
    }
    if (mine === latest.current) setState(next);
  }, []);

  const clear = useCallback(() => {
    latest.current += 1;
    setState({ kind: 'idle' });
  }, []);

  return { state, run, clear };
}

/** The prepared photo as JPEG bytes at most IDENTIFY_LONG_EDGE on its long edge. */
async function shrink(prepared: string): Promise<Uint8Array> {
  const file = new File(await prepare(prepared, IDENTIFY_LONG_EDGE));
  try {
    return await file.bytes();
  } finally {
    // Only the prepared photo stays; this copy was for Pl@ntNet.
    file.delete();
  }
}
