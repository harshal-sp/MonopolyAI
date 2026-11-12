import { DefaultWeights } from './evaluator.js';

export const AIProfiles = {
  minimax: {
    id: 'minimax',
    name: 'Minimax Grandmaster',
    avatar: '🧠',
    description: 'Advanced Expectiminimax game tree search with configurable lookahead & dynamic game-phase adaptation.',
    depth: 2,
    weights: { ...DefaultWeights }
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive Monopolist',
    avatar: '⚡',
    description: 'High risk tolerance, aggressive land grab, rushes to build 4 houses & hotels to bankrupt opponents.',
    depth: 2,
    weights: {
      ...DefaultWeights,
      cash: 0.6,
      propertyValue: 1.6,
      monopolyComplete: 1400,
      monopolyPartial: 400,
      houseValue: 2.2,
      expectedHazard: 1.5,
      bankruptcyPenalty: 3000
    }
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious Capitalist',
    avatar: '🛡️',
    description: 'Prioritizes liquidity ($400+ safety reserve), avoids rent hazards, and only develops with surplus cash.',
    depth: 2,
    weights: {
      ...DefaultWeights,
      cash: 2.2,
      propertyValue: 0.9,
      monopolyComplete: 700,
      monopolyPartial: 180,
      houseValue: 1.1,
      expectedHazard: 4.5,
      bankruptcyPenalty: 9000
    }
  },
  baron: {
    id: 'baron',
    name: 'Transit & Utility Baron',
    avatar: '🚂',
    description: 'Targeted acquisition strategy focusing on high-frequency transit lines (Railroads & Orange sets).',
    depth: 2,
    weights: {
      ...DefaultWeights,
      cash: 1.0,
      propertyValue: 1.4,
      monopolyComplete: 1100,
      monopolyPartial: 300,
      expectedIncome: 4.5,
      expectedHazard: 2.5
    }
  },
  novice: {
    id: 'novice',
    name: 'Novice Heuristic',
    avatar: '🎲',
    description: 'Baseline heuristic agent that buys purely based on immediate cash balance without deep tree lookahead.',
    depth: 1,
    weights: {
      cash: 1.0,
      propertyValue: 1.0,
      monopolyComplete: 400,
      monopolyPartial: 100,
      houseValue: 1.0,
      expectedIncome: 1.0,
      expectedHazard: 1.0,
      jailValue: 0,
      bankruptcyPenalty: 2000
    }
  }
};
