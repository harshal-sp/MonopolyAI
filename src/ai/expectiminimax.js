import { BoardSquares, ColorGroups, TileTypes, DiceProbabilities } from '../engine/boardData.js';
import { HeuristicEvaluator } from './evaluator.js';

export class ExpectiminimaxEngine {
  constructor(evaluator = new HeuristicEvaluator(), maxDepth = 3) {
    this.evaluator = evaluator;
    this.setDepth(maxDepth);
    this.lastDecisionTree = null;
    this.lastDecisionExplanation = '';
  }

  // The initial buy/pass decision consumes one ply. Each simulated move uses
  // one more: AI roll (2), opponent response (3), next AI roll (4).
  setDepth(depth) {
    const value = Number(depth);
    this.maxDepth = Number.isFinite(value) ? Math.max(1, Math.min(4, Math.trunc(value))) : 3;
  }

  // Main entry point: Decide whether to buy a property after landing on it
  decideBuy(state, playerId, tileIndex) {
    const sq = BoardSquares[tileIndex];
    const player = state.players[playerId];

    // Root of decision tree for visualizer
    const treeRoot = {
      id: 'root_buy',
      name: `Land on ${sq.name}`,
      type: 'MAX',
      depth: this.maxDepth,
      details: `${this.maxDepth}-ply search · Player ${player.name} (Cash: $${player.money}) deciding to Buy or Pass ${sq.name} ($${sq.price})`,
      children: []
    };

    // If cannot afford, must pass
    if (player.money < sq.price) {
      this.lastDecisionTree = treeRoot;
      this.lastDecisionExplanation = `Cannot afford ${sq.name} ($${sq.price}) with $${player.money} cash.`;
      return { action: 'pass', reason: this.lastDecisionExplanation, tree: treeRoot };
    }

    // Branch 1: BUY
    const buyState = state.clone();
    buyState.buyProperty(playerId, tileIndex);
    const buyChanceNode = {
      id: 'branch_buy',
      action: `BUY ${sq.name} (-$${sq.price})`,
      type: 'CHANCE',
      immediateCost: sq.price,
      children: []
    };

    const buyEV = this.evaluateChanceNode(buyState, playerId, this.maxDepth - 1, buyChanceNode);
    buyChanceNode.score = Math.round(buyEV);
    treeRoot.children.push(buyChanceNode);

    // Branch 2: PASS
    const passState = state.clone();
    // Do not buy
    const passChanceNode = {
      id: 'branch_pass',
      action: `PASS ${sq.name} (Keep $${player.money})`,
      type: 'CHANCE',
      immediateCost: 0,
      children: []
    };

    const passEV = this.evaluateChanceNode(passState, playerId, this.maxDepth - 1, passChanceNode);
    passChanceNode.score = Math.round(passEV);
    treeRoot.children.push(passChanceNode);

    // Pick best action based on Expected Value
    const shouldBuy = buyEV >= passEV;
    buyChanceNode.chosen = shouldBuy;
    passChanceNode.chosen = !shouldBuy;

    // Special Monopoly completeness bonus reasoning
    const completesMonopoly = buyState.ownsEntireGroup(playerId, sq.group);

    const delta = Math.round(buyEV - passEV);
    let reason = '';
    if (shouldBuy) {
      reason = `BUY ${sq.name} (EV: ${buyChanceNode.score} vs Pass: ${passChanceNode.score}, Delta: +${delta})${completesMonopoly ? ' - Completes Monopoly!' : ''}`;
    } else {
      reason = `PASS ${sq.name} (Pass EV: ${passChanceNode.score} > Buy EV: ${buyChanceNode.score}, preserving cash for liquidity)`;
    }

    this.lastDecisionTree = treeRoot;
    this.lastDecisionExplanation = reason;

    return {
      action: shouldBuy ? 'buy' : 'pass',
      expectedValue: shouldBuy ? buyEV : passEV,
      reason,
      tree: treeRoot
    };
  }

  // Pre-roll decision: evaluate building houses across owned monopolies
  decideUpgrades(state, playerId) {
    const player = state.players[playerId];
    const upgradesToMake = [];

    // Safety cash reserve: do not build if cash drops below minimum safety threshold
    const safetyCashReserve = state.getGamePhase ? 200 : 250;

    // Check all monopolies owned by player
    for (const groupKey in ColorGroups) {
      const group = ColorGroups[groupKey];
      if (group.housePrice === 0) continue; // Skip Utilities and Railroads

      if (state.ownsEntireGroup(playerId, group.id)) {
        // Can build houses
        let buildPossible = true;
        while (buildPossible && player.money - upgradesToMake.length * group.housePrice > safetyCashReserve + group.housePrice) {
          // Find lowest house count in the group to maintain even building
          const memberProps = group.memberIndices.map(i => state.properties[i]);
          const minHouses = Math.min(...memberProps.map(p => p.houses));

          if (minHouses >= 5) {
            // Already hotels on all!
            break;
          }

          // Pick the first property that has minHouses
          const targetProp = memberProps.find(p => p.houses === minHouses);
          if (targetProp) {
            // Evaluate if building this house improves state EV
            const simState = state.clone();
            const built = simState.buildHouse(playerId, targetProp.index);
            if (built) {
              const currentScore = this.evaluator.evaluate(state, playerId);
              const upgradedScore = this.evaluator.evaluate(simState, playerId);

              if (upgradedScore > currentScore || minHouses < 3) {
                // Building up to 3 houses is almost always optimal in Monopoly
                upgradesToMake.push(targetProp.index);
              } else {
                buildPossible = false;
              }
            } else {
              buildPossible = false;
            }
          } else {
            buildPossible = false;
          }
        }
      }
    }

    return upgradesToMake;
  }

  // Decide whether to unmortgage properties if rich
  decideUnmortgage(state, playerId) {
    const player = state.players[playerId];
    if (player.money < 450) return []; // Need healthy cash buffer

    const unmortgageList = [];
    let tempMoney = player.money;

    for (const idx in state.properties) {
      const prop = state.properties[idx];
      const sq = BoardSquares[prop.index];
      if (prop.owner === playerId && prop.mortgaged) {
        const cost = Math.floor(sq.mortgage * 1.1);
        if (tempMoney - cost > 250) {
          unmortgageList.push(prop.index);
          tempMoney -= cost;
        }
      }
    }

    return unmortgageList;
  }

  // Decide how to get out of Jail
  decideJailAction(state, playerId) {
    const player = state.players[playerId];
    if (!player.inJail) return 'none';

    // If has card, always use it
    if (player.getOutOfJailCards > 0) {
      return 'card';
    }

    const phase = this.evaluator.getGamePhase(state);

    if (phase === 'early') {
      // In early game, properties are unowned! Pay $50 immediately to get out and buy land
      if (player.money >= 100) {
        return 'pay';
      }
    } else if (phase === 'late') {
      // In late game, board is covered in deadly hotels. Rolling for doubles is safer
      // Only pay if forced (3rd turn)
      if (player.jailTurns >= 2 && player.money >= 50) {
        return 'pay';
      }
      return 'roll';
    }

    return player.money > 200 ? 'pay' : 'roll';
  }

  // Evaluate a proposed trade from another player
  evaluateTradeOffer(state, playerId, trade) {
    const currentScore = this.evaluator.evaluate(state, playerId);

    const simState = state.clone();
    const success = simState.executeTrade(trade);
    if (!success) {
      return { accept: false, reason: 'Invalid trade conditions' };
    }

    const tradeScore = this.evaluator.evaluate(simState, playerId);
    const scoreDiff = tradeScore - currentScore;

    // Accept if the trade benefits our Expectiminimax evaluation
    const accept = scoreDiff > 0;
    return {
      accept,
      delta: Math.round(scoreDiff),
      reason: accept
        ? `Accept: Trade increases AI evaluation by +${Math.round(scoreDiff)} points`
        : `Decline: Trade decreases AI evaluation by ${Math.round(scoreDiff)} points`
    };
  }

  // Evaluate Chance Node (calculates expected value across all 11 dice outcomes: rolls 2 through 12)
  evaluateChanceNode(state, playerId, depth, nodeRecord = null) {
    if (depth <= 0 || state.winner !== null || state.players[playerId].bankrupt) {
      return this.evaluator.evaluate(state, playerId);
    }

    let expectedValue = 0;

    // Evaluate standard 2d6 distribution
    for (let roll = 2; roll <= 12; roll++) {
      const prob = DiceProbabilities[roll];
      const nextState = state.clone();

      // Simulate move for player
      nextState.movePlayer(playerId, roll, { collectGo: true });

      // If landed on unowned property, simulate greedy buy if affordable
      const tileIndex = nextState.players[playerId].position;
      const sq = BoardSquares[tileIndex];
      const prop = nextState.properties[tileIndex];

      if (prop && prop.owner === null && nextState.players[playerId].money >= sq.price + 100) {
        nextState.buyProperty(playerId, tileIndex);
      }

      const outcomeRecord = nodeRecord ? {
        id: `roll_${roll}`,
        action: `Roll ${roll} (P=${(prob * 100).toFixed(1)}%) -> Land on ${sq.name}`,
        type: depth > 1 && nextState.winner === null && !nextState.players[playerId].bankrupt ? 'MIN' : 'LEAF',
        probability: prob,
        children: []
      } : null;

      // Continue until the requested horizon instead of stopping at MIN.
      let outcomeScore = 0;
      if (depth > 1) {
        const responseRecord = outcomeRecord?.type === 'MIN' ? {
          action: 'Opponent response', type: 'CHANCE', children: []
        } : null;
        outcomeScore = this.evaluateMinNode(nextState, playerId, depth - 1, responseRecord);
        if (responseRecord?.children.length) {
          responseRecord.score = Math.round(outcomeScore);
          outcomeRecord.children.push(responseRecord);
        }
      } else {
        outcomeScore = this.evaluator.evaluate(nextState, playerId);
      }

      expectedValue += prob * outcomeScore;

      // Retain all evaluated outcomes for inspection in the decision diagram.
      if (nodeRecord) {
        outcomeRecord.score = Math.round(outcomeScore);
        if (!outcomeRecord.children.length) outcomeRecord.type = 'LEAF';
        nodeRecord.children.push(outcomeRecord);
      }
    }

    return expectedValue;
  }

  // Evaluate Min Node (models opponents making moves that benefit themselves / counter AI)
  evaluateMinNode(state, playerId, depth, nodeRecord = null) {
    if (depth <= 0 || state.winner !== null || state.players[playerId].bankrupt) {
      return this.evaluator.evaluate(state, playerId);
    }

    const opponents = state.getAlivePlayers().filter(p => p.id !== playerId);
    if (opponents.length === 0) {
      return this.evaluator.evaluate(state, playerId);
    }

    // Keep the existing primary-competitor model. Its moves are stochastic,
    // with greedy purchases, so average dice outcomes rather than minimizing rolls.
    let totalScore = 0;
    const opp = opponents[0]; // Primary competitor
    if (nodeRecord) nodeRecord.action = `${opp.name} response`;

    for (let roll = 2; roll <= 12; roll++) {
      const prob = DiceProbabilities[roll];
      const oppState = state.clone();
      oppState.movePlayer(opp.id, roll, { collectGo: true });

      const oppTile = oppState.players[opp.id].position;
      const oppSq = BoardSquares[oppTile];
      const oppProp = oppState.properties[oppTile];

      if (oppProp && oppProp.owner === null && oppState.players[opp.id].money >= oppSq.price + 50) {
        oppState.buyProperty(opp.id, oppTile);
      }

      const canContinue = depth > 1 && oppState.winner === null && !oppState.players[playerId].bankrupt;
      const continuation = nodeRecord && canContinue ? {
        action: `${oppState.players[playerId].name} next roll`, type: 'CHANCE', children: []
      } : null;
      const score = this.evaluateChanceNode(oppState, playerId, depth - 1, continuation);
      totalScore += prob * score;
      if (nodeRecord) {
        if (continuation) continuation.score = Math.round(score);
        nodeRecord.children.push({
          id: `opponent_roll_${roll}`,
          action: `Roll ${roll} (P=${(prob * 100).toFixed(1)}%) -> ${opp.name} lands on ${oppSq.name}`,
          type: canContinue ? 'CHANCE' : 'LEAF',
          probability: prob,
          score: Math.round(score),
          children: continuation ? [continuation] : []
        });
      }
    }

    return totalScore;
  }
}
