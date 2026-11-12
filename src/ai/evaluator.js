import { BoardSquares, ColorGroups, TileTypes, DiceProbabilities } from '../engine/boardData.js';

// Default baseline evaluation weights (can be tuned or evolved by trainer)
export const DefaultWeights = {
  cash: 1.0,               // Value per $1 cash
  propertyValue: 1.2,      // Value per $1 property face value
  monopolyComplete: 900,   // Bonus for completing a color set
  monopolyPartial: 250,    // Bonus for holding 2/3 of a set
  houseValue: 1.6,         // Value multiplier for invested house capital
  expectedIncome: 3.5,     // Multiplier for expected rent from opponents
  expectedHazard: 2.8,     // Penalty multiplier for expected rent hazard
  jailValue: -100,         // Value of being in jail (negative in early game, positive in late)
  bankruptcyPenalty: 5000  // Penalty if player is bankrupt or near zero
};

export class HeuristicEvaluator {
  constructor(customWeights = {}) {
    this.weights = { ...DefaultWeights, ...customWeights };
  }

  // Determine game phase dynamically
  getGamePhase(state) {
    const unownedCount = Object.values(state.properties).filter(p => p.owner === null).length;
    if (unownedCount > 10) return 'early'; // Land Grab phase
    if (unownedCount > 2) return 'mid';    // Monopoly Assembly phase
    return 'late';                         // High Stakes / Endgame
  }

  // Dynamically adjust weights based on game phase and player situation
  getDynamicWeights(state, playerId) {
    const phase = this.getGamePhase(state);
    const player = state.players[playerId];
    const w = { ...this.weights };

    // 1. Proximity to Win Target
    if (state.winTarget > 0 && player.money > state.winTarget * 0.75) {
      // Very close to target balance: prioritize pure cash liquidity to seal victory!
      w.cash *= 2.5;
      w.expectedHazard *= 3.0; // Don't take unnecessary risks
    }

    // 2. Game Phase adjustments
    if (phase === 'early') {
      // Early game: Rush to grab any land
      w.propertyValue *= 1.5;
      w.monopolyPartial *= 1.4;
      w.houseValue *= 0.8;
      w.jailValue = -250; // Get out of jail immediately to buy land!
    } else if (phase === 'mid') {
      // Mid game: Complete monopolies and build houses (sweet spot: 3 houses)
      w.monopolyComplete *= 1.5;
      w.houseValue *= 1.8;
      w.expectedIncome *= 1.5;
      w.jailValue = 0;
    } else {
      // Late game: Lethal rent hazards; jail becomes a cozy safe haven!
      w.cash *= 1.4;
      w.expectedHazard *= 2.0;
      w.expectedIncome *= 1.8;
      w.jailValue = 350; // Late game: stay in jail as long as possible to avoid hotels!
    }

    // 3. Crisis adjustment (low liquidity)
    if (player.money < 150) {
      w.expectedHazard *= 2.5;
      w.cash *= 2.0;
    }

    return w;
  }

  // Calculate Expected Rent Income from all opponents over the next turn
  calculateExpectedRentIncome(state, playerId) {
    let totalExpectedIncome = 0;
    const opponents = state.getAlivePlayers().filter(p => p.id !== playerId);

    opponents.forEach(opponent => {
      if (opponent.inJail) return; // Opponent might not move immediately

      for (let roll = 2; roll <= 12; roll++) {
        const prob = DiceProbabilities[roll];
        const targetTile = (opponent.position + roll) % 40;
        const prop = state.properties[targetTile];

        if (prop && prop.owner === playerId && !prop.mortgaged) {
          const rent = state.calculateRent(targetTile);
          totalExpectedIncome += prob * rent;
        }
      }
    });

    return totalExpectedIncome;
  }

  // Calculate Expected Rent Hazard (danger of paying rent over next roll)
  calculateExpectedRentHazard(state, playerId) {
    const player = state.players[playerId];
    if (player.inJail) return 0; // Safe while in jail

    let totalHazard = 0;
    for (let roll = 2; roll <= 12; roll++) {
      const prob = DiceProbabilities[roll];
      const targetTile = (player.position + roll) % 40;
      const prop = state.properties[targetTile];

      if (prop && prop.owner !== null && prop.owner !== playerId && !prop.mortgaged) {
        const rent = state.calculateRent(targetTile);
        totalHazard += prob * rent;
      }
    }

    return totalHazard;
  }

  // Comprehensive state evaluation for a player
  evaluate(state, playerId) {
    const player = state.players[playerId];
    if (player.bankrupt) {
      return -this.weights.bankruptcyPenalty * 10;
    }

    if (state.winner !== null) {
      if (state.winner.id === playerId) {
        return 100000; // Winning terminal state
      } else {
        return -100000; // Losing terminal state
      }
    }

    const w = this.getDynamicWeights(state, playerId);
    let score = 0;

    // 1. Cash Balance & Liquidity Score
    score += player.money * w.cash;
    if (player.money < 100) {
      score -= (100 - player.money) * 8; // Heavy danger penalty
    }

    // 2. Property & Monopoly Values
    let totalPropEquity = 0;
    let totalHouseEquity = 0;
    let monopolyBonus = 0;

    // Check each color group
    for (const groupKey in ColorGroups) {
      const group = ColorGroups[groupKey];
      const members = group.memberIndices;
      const ownedByPlayer = members.filter(idx => state.properties[idx].owner === playerId);

      // Property value
      ownedByPlayer.forEach(idx => {
        const prop = state.properties[idx];
        const sq = BoardSquares[idx];
        if (prop.mortgaged) {
          totalPropEquity += sq.mortgage;
        } else {
          totalPropEquity += sq.price;
          if (prop.houses > 0) {
            // Strategic bonus for 3 houses (optimal ROI in Monopoly)
            const houseBonus = prop.houses === 3 ? 1.3 : 1.0;
            totalHouseEquity += prop.houses * sq.housePrice * houseBonus;
          }
        }
      });

      // Monopolies
      if (ownedByPlayer.length === members.length) {
        // Complete monopoly!
        // High-traffic color groups (Orange, Red, Yellow) receive extra strategic value
        let trafficMultiplier = 1.0;
        if (group.id === 'orange') trafficMultiplier = 1.35; // Most landed-on from jail!
        if (group.id === 'red') trafficMultiplier = 1.25;
        if (group.id === 'yellow') trafficMultiplier = 1.15;

        monopolyBonus += w.monopolyComplete * trafficMultiplier;
      } else if (ownedByPlayer.length === members.length - 1 && members.length > 2) {
        // 2 out of 3 properties (1 away from a monopoly)
        monopolyBonus += w.monopolyPartial;
      }
    }

    score += totalPropEquity * w.propertyValue;
    score += totalHouseEquity * w.houseValue;
    score += monopolyBonus;

    // 3. Expected Cash Flow (Income vs Hazard)
    const expectedIncome = this.calculateExpectedRentIncome(state, playerId);
    const expectedHazard = this.calculateExpectedRentHazard(state, playerId);

    score += expectedIncome * w.expectedIncome;
    score -= expectedHazard * w.expectedHazard;

    // 4. Jail Status Value
    if (player.inJail) {
      score += w.jailValue;
    }

    // 5. Get Out of Jail Free cards
    score += player.getOutOfJailCards * 40;

    // 6. Relative Net Worth Advantage vs Opponents
    const myNetWorth = state.getPlayerNetWorth(playerId);
    const opponents = state.getAlivePlayers().filter(p => p.id !== playerId);
    if (opponents.length > 0) {
      const avgOpponentNetWorth = opponents.reduce((acc, p) => acc + state.getPlayerNetWorth(p.id), 0) / opponents.length;
      score += (myNetWorth - avgOpponentNetWorth) * 0.4;
    }

    return score;
  }

  // Get a readable breakdown of how the score was calculated (for UI/Visualizer)
  explainScore(state, playerId) {
    const player = state.players[playerId];
    const w = this.getDynamicWeights(state, playerId);
    const expectedIncome = this.calculateExpectedRentIncome(state, playerId);
    const expectedHazard = this.calculateExpectedRentHazard(state, playerId);

    let propCount = 0;
    let monopolyCount = 0;
    for (const groupKey in ColorGroups) {
      const group = ColorGroups[groupKey];
      if (group.memberIndices.every(i => state.properties[i].owner === playerId)) {
        monopolyCount++;
      }
      propCount += group.memberIndices.filter(i => state.properties[i].owner === playerId).length;
    }

    return {
      totalScore: Math.round(this.evaluate(state, playerId)),
      cash: Math.round(player.money),
      propertiesOwned: propCount,
      monopolies: monopolyCount,
      expectedIncome: Math.round(expectedIncome),
      expectedHazard: Math.round(expectedHazard),
      phase: this.getGamePhase(state),
      netWorth: Math.round(state.getPlayerNetWorth(playerId))
    };
  }
}
