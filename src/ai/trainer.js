import { GameState } from '../engine/gameState.js';
import { HeuristicEvaluator, DefaultWeights } from './evaluator.js';
import { ExpectiminimaxEngine } from './expectiminimax.js';
import { AIProfiles } from './aiProfiles.js';

export class AITrainer {
  constructor() {
    this.isTraining = false;
    this.trainingLog = [];
  }

  // Run a single fast headless simulation between two AI configurations
  static simulateGame(p1Profile, p2Profile, maxTurns = 150, winTarget = 4000) {
    const p1Weights = p1Profile.weights || DefaultWeights;
    const p2Weights = p2Profile.weights || DefaultWeights;

    const p1Engine = new ExpectiminimaxEngine(new HeuristicEvaluator(p1Weights), p1Profile.depth || 1);
    const p2Engine = new ExpectiminimaxEngine(new HeuristicEvaluator(p2Weights), p2Profile.depth || 1);

    const game = new GameState({
      winTarget,
      startingCash: 1500,
      players: [
        { id: 0, name: p1Profile.name, type: 'ai', profile: p1Profile.id },
        { id: 1, name: p2Profile.name, type: 'ai', profile: p2Profile.id }
      ]
    });

    let turns = 0;
    while (game.winner === null && turns < maxTurns) {
      const activeP = game.getActivePlayer();
      const engine = activeP.id === 0 ? p1Engine : p2Engine;

      // 1. Jail decision
      if (activeP.inJail) {
        const jailDecision = engine.decideJailAction(game, activeP.id);
        if (jailDecision === 'card' && activeP.getOutOfJailCards > 0) {
          game.releaseFromJail(activeP.id, 'card');
        } else if (jailDecision === 'pay' && activeP.money >= 50) {
          game.releaseFromJail(activeP.id, 'pay');
        }
      }

      // 2. Pre-roll upgrades
      const upgrades = engine.decideUpgrades(game, activeP.id);
      upgrades.forEach(tileIndex => {
        game.buildHouse(activeP.id, tileIndex);
      });

      // 3. Roll Dice
      const rollRes = game.rollDice();
      if (!rollRes || game.winner !== null) break;

      // 4. Post-roll Buy decision if applicable
      const tileIndex = activeP.position;
      const prop = game.properties[tileIndex];
      if (prop && prop.owner === null) {
        const buyDecision = engine.decideBuy(game, activeP.id, tileIndex);
        if (buyDecision.action === 'buy') {
          game.buyProperty(activeP.id, tileIndex);
        }
      }

      // 5. Unmortgage if excess cash
      const unmortgageList = engine.decideUnmortgage(game, activeP.id);
      unmortgageList.forEach(idx => game.unmortgageProperty(activeP.id, idx));

      // End turn
      game.endTurn();
      turns++;
    }

    // If reached maxTurns without decisive winner, pick highest net worth
    let winnerId = null;
    let reason = 'bankruptcy';
    if (game.winner !== null) {
      winnerId = game.winner.id;
      reason = game.players[0].bankrupt || game.players[1].bankrupt ? 'bankruptcy' : 'target_balance';
    } else {
      const nw0 = game.getPlayerNetWorth(0);
      const nw1 = game.getPlayerNetWorth(1);
      winnerId = nw0 >= nw1 ? 0 : 1;
      reason = 'net_worth_limit';
    }

    return {
      winnerId,
      turns,
      reason,
      p1FinalNetWorth: game.getPlayerNetWorth(0),
      p2FinalNetWorth: game.getPlayerNetWorth(1),
      p1Cash: game.players[0].money,
      p2Cash: game.players[1].money
    };
  }

  // Run a tournament between two AI profiles over N games
  static async runBenchmark(p1Profile, p2Profile, numGames = 50, onProgress = null) {
    let p1Wins = 0;
    let p2Wins = 0;
    let totalTurns = 0;
    let p1TotalNetWorth = 0;
    let p2TotalNetWorth = 0;

    for (let i = 0; i < numGames; i++) {
      // Alternate starting player for fairness
      const swap = i % 2 === 1;
      const res = swap
        ? this.simulateGame(p2Profile, p1Profile)
        : this.simulateGame(p1Profile, p2Profile);

      const actualWinnerP1 = swap ? res.winnerId === 1 : res.winnerId === 0;

      if (actualWinnerP1) p1Wins++;
      else p2Wins++;

      totalTurns += res.turns;
      p1TotalNetWorth += swap ? res.p2FinalNetWorth : res.p1FinalNetWorth;
      p2TotalNetWorth += swap ? res.p1FinalNetWorth : res.p2FinalNetWorth;

      if (onProgress && i % 5 === 0) {
        onProgress({
          completed: i + 1,
          total: numGames,
          p1Wins,
          p2Wins
        });
        // Yield to browser event loop
        await new Promise(r => setTimeout(r, 0));
      }
    }

    return {
      p1Profile,
      p2Profile,
      numGames,
      p1Wins,
      p2Wins,
      p1WinRate: ((p1Wins / numGames) * 100).toFixed(1) + '%',
      p2WinRate: ((p2Wins / numGames) * 100).toFixed(1) + '%',
      avgTurns: (totalTurns / numGames).toFixed(1),
      p1AvgNetWorth: Math.round(p1TotalNetWorth / numGames),
      p2AvgNetWorth: Math.round(p2TotalNetWorth / numGames)
    };
  }

  // Genetic Algorithm to evolve / train optimal weights
  static async trainGenetic({
    generations = 5,
    populationSize = 6,
    gamesPerMatch = 6,
    onEpoch = null
  }) {
    // Generate initial population by mutating baseline weights
    let population = [];
    for (let i = 0; i < populationSize; i++) {
      if (i === 0) {
        population.push({ ...DefaultWeights });
      } else {
        population.push(this.mutateWeights({ ...DefaultWeights }, 0.25));
      }
    }

    const baselineProfile = AIProfiles.novice;
    const history = [];

    for (let gen = 0; gen < generations; gen++) {
      const fitnessScores = [];

      for (let i = 0; i < population.length; i++) {
        const candidateProfile = {
          id: `cand_${gen}_${i}`,
          name: `Candidate ${i}`,
          weights: population[i],
          depth: 1
        };

        const bench = await this.runBenchmark(candidateProfile, baselineProfile, gamesPerMatch);
        // Fitness: win rate weighted with average net worth
        const fitness = (bench.p1Wins / gamesPerMatch) * 1000 + bench.p1AvgNetWorth * 0.2;
        fitnessScores.push({ index: i, fitness, weights: population[i], winRate: bench.p1WinRate });
      }

      // Sort by fitness descending
      fitnessScores.sort((a, b) => b.fitness - a.fitness);
      const bestOfGen = fitnessScores[0];

      history.push({
        generation: gen + 1,
        bestFitness: Math.round(bestOfGen.fitness),
        bestWinRate: bestOfGen.winRate,
        weights: { ...bestOfGen.weights }
      });

      if (onEpoch) {
        onEpoch({
          generation: gen + 1,
          totalGenerations: generations,
          best: bestOfGen,
          history
        });
      }

      // Selection & Crossover: Top 50% survive
      const survivors = fitnessScores.slice(0, Math.floor(populationSize / 2)).map(s => s.weights);
      const newPop = [...survivors];

      while (newPop.length < populationSize) {
        const parentA = survivors[Math.floor(Math.random() * survivors.length)];
        const parentB = survivors[Math.floor(Math.random() * survivors.length)];
        const child = this.crossover(parentA, parentB);
        newPop.push(this.mutateWeights(child, 0.15));
      }

      population = newPop;
    }

    return {
      bestWeights: history[history.length - 1].weights,
      history
    };
  }

  static crossover(w1, w2) {
    const child = {};
    for (const key in w1) {
      child[key] = Math.random() < 0.5 ? w1[key] : w2[key];
    }
    return child;
  }

  static mutateWeights(weights, mutationRate = 0.2) {
    const mutated = { ...weights };
    for (const key in mutated) {
      if (Math.random() < 0.6) {
        const factor = 1 + (Math.random() * 2 - 1) * mutationRate;
        mutated[key] = Math.max(0, mutated[key] * factor);
      }
    }
    return mutated;
  }
}
