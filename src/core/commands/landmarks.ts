import { landmarkPixels, type LandmarkOffer } from '../alignment/landmarks';
import type { MatchId } from '../model/project';
import { addMatch, type Command } from './command';
import { removeFeatures } from './features';

/**
 * Accepts a landmark offer (SPEC F9) as one step: the new via goes, a matched point takes its
 * place and the alignment, derived from the matches, is solved again. The existing via keeps its
 * board position. Changes nothing when a via of the offer is gone.
 */
export const addLandmarkFromVias = (offer: LandmarkOffer, matchId: MatchId): Command => ({
  label: 'Use via as landmark',
  execute: (project) => {
    const points = landmarkPixels(project, offer);
    if (points === null) {
      return project;
    }
    const withoutNewVia = removeFeatures([offer.newViaId]).execute(project);
    return addMatch({ id: matchId, points }).execute(withoutNewVia);
  },
});
