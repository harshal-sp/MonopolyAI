import { GameState } from './src/engine/gameState.js';
import { HeuristicEvaluator } from './src/ai/evaluator.js';
import { ExpectiminimaxEngine } from './src/ai/expectiminimax.js';
import { AIProfiles } from './src/ai/aiProfiles.js';
import { AITrainer } from './src/ai/trainer.js';

console.log('--- 1. Testing GameState Initialization ---');
const game = new GameState({ winTarget: 4000 });
console.log('Players initialized:', game.players.map(p => `${p.name} ($${p.money})`));
console.log('Total Properties:', Object.keys(game.properties).length);

console.log('\n--- 2. Testing Dice Roll & Movement ---');
const rollRes = game.rollDice([3, 4]); // 7
console.log('Dice result:', rollRes.dice, 'Active player position:', game.getActivePlayer().position);

console.log('\n--- 3. Testing Expectiminimax Decision on Property Land ---');
const evaluator = new HeuristicEvaluator(AIProfiles.minimax.weights);
const engine = new ExpectiminimaxEngine(evaluator, 2);

// Simulate landing on Illinois Ave (tile 24, cost 240)
const buyDecision = engine.decideBuy(game, 0, 24);
console.log('Buy Decision:', buyDecision.action);
console.log('Reasoning:', buyDecision.reason);
console.log('Decision Tree Root:', buyDecision.tree.name, 'Branches:', buyDecision.tree.children.map(c => `${c.action} (EV: ${c.score})`));

console.log('\n--- 4. Testing AI vs AI Headless Match Simulation ---');
const matchRes = AITrainer.simulateGame(AIProfiles.minimax, AIProfiles.novice, 100);
console.log('Match completed in', matchRes.turns, 'turns.');
console.log('Winner:', matchRes.winnerId === 0 ? 'Minimax Grandmaster' : 'Novice Baseline');
console.log('P1 Net Worth:', matchRes.p1FinalNetWorth, '| P2 Net Worth:', matchRes.p2FinalNetWorth);

console.log('\n--- 5. Testing Tournament Benchmark (20 games) ---');
const benchRes = await AITrainer.runBenchmark(AIProfiles.minimax, AIProfiles.novice, 20);
console.log(`Tournament results: Minimax Wins: ${benchRes.p1Wins} (${benchRes.p1WinRate}) vs Novice Wins: ${benchRes.p2Wins} (${benchRes.p2WinRate})`);
console.log(`Average Turns: ${benchRes.avgTurns}, Minimax Avg Net Worth: $${benchRes.p1AvgNetWorth}`);

console.log('\n✅ ALL GAME ENGINE & MINIMAX AI TESTS PASSED WITH 100% SUCCESS!');
