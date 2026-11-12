import test from 'node:test';
import assert from 'node:assert/strict';
import { ExpectiminimaxEngine } from '../src/ai/expectiminimax.js';
import { GameState } from '../src/engine/gameState.js';
import { BoardSquares } from '../src/engine/boardData.js';

// A deterministic state makes the search horizon observable independently of
// shuffled cards, purchases, or the production heuristic.
class SearchState {
  constructor() {
    this.players = [0, 1].map(id => ({ id, name: `Player ${id}`, money: 1500, position: 0, bankrupt: false }));
    this.properties = { 24: { owner: null } };
    this.winner = null;
    this.moves = [];
    this.finishOnMove = false;
  }

  clone() {
    const copy = new SearchState();
    copy.players = this.players.map(player => ({ ...player }));
    copy.properties = { 24: { ...this.properties[24] } };
    copy.moves = [...this.moves];
    copy.winner = this.winner;
    copy.finishOnMove = this.finishOnMove;
    return copy;
  }

  movePlayer(id) {
    this.moves.push(id);
    if (this.finishOnMove) this.winner = this.players[id];
  }

  buyProperty(id, index) {
    this.properties[index].owner = id;
    this.players[id].money -= BoardSquares[index].price;
  }

  getAlivePlayers() { return this.players; }
  ownsEntireGroup() { return false; }
}

test('depth defaults to 3 and supports validated 1–4 ply in constructor and setter', () => {
  const engine = new ExpectiminimaxEngine();
  assert.equal(engine.maxDepth, 3);
  for (const [input, expected] of [[4, 4], [8, 4], [0, 1], [3.8, 3], ['4', 4], [NaN, 3]]) {
    engine.setDepth(input);
    assert.equal(engine.maxDepth, expected);
    assert.equal(new ExpectiminimaxEngine(undefined, input).maxDepth, expected);
  }
});

for (const [depth, path] of [[2, [0]], [3, [0, 1]], [4, [0, 1, 0]]]) {
  test(`${depth} ply evaluates the requested move sequence and complete dice distribution`, () => {
    const paths = [];
    const engine = new ExpectiminimaxEngine({
      evaluate(state) {
        paths.push([...state.moves]);
        return state.moves.reduce((score, id) => score * 10 + id + 1, 0);
      }
    }, depth);
    const state = new SearchState();
    const result = engine.decideBuy(state, 0, 24);
    assert.equal(result.tree.depth, depth);
    assert.equal(paths.length, 2 * 11 ** (depth - 1));
    for (const actualPath of paths) assert.deepEqual(actualPath, path);
    assert.ok(Math.abs(result.expectedValue - Number(path.map(id => id + 1).join(''))) < 1e-8);
    assert.deepEqual(state.moves, []);
    assert.equal(state.properties[24].owner, null);
    assert.equal(state.players[0].money, 1500);

    let chanceNode = result.tree.children[0];
    for (let remaining = depth - 1; remaining > 0; remaining--) {
      assert.equal(chanceNode.children.length, 11);
      assert.ok(Math.abs(chanceNode.children.reduce((total, outcome) => total + outcome.probability, 0) - 1) < 1e-10);
      const outcome = chanceNode.children[0];
      if (remaining === 1) {
        assert.equal(outcome.type, 'LEAF');
        assert.deepEqual(outcome.children, []);
      } else {
        assert.equal(outcome.children.length, 1);
        chanceNode = outcome.children[0];
      }
    }
  });
}

test('4-ply search stops at terminal outcomes and records no continuation', () => {
  const state = new SearchState();
  state.finishOnMove = true;
  let evaluations = 0;
  const engine = new ExpectiminimaxEngine({ evaluate(leaf) {
    evaluations++;
    assert.equal(leaf.moves.length, 1);
    return 100;
  } }, 4);
  const result = engine.decideBuy(state, 0, 24);
  assert.equal(evaluations, 22);
  for (const action of result.tree.children) for (const outcome of action.children) {
    assert.equal(outcome.type, 'LEAF');
    assert.deepEqual(outcome.children, []);
  }
});

test('4-ply production search leaves the live game unchanged', () => {
  const game = new GameState();
  game.players[0].position = 24;
  const before = JSON.stringify(game);
  const result = new ExpectiminimaxEngine(undefined, 4).decideBuy(game, 0, 24);
  assert.ok(Number.isFinite(result.expectedValue));
  assert.equal(JSON.stringify(game), before);
});
