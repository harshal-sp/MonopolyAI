import { GameState } from './engine/gameState.js';
import { BoardSquares, TileTypes } from './engine/boardData.js';
import { HeuristicEvaluator } from './ai/evaluator.js';
import { ExpectiminimaxEngine } from './ai/expectiminimax.js';
import { AIProfiles } from './ai/aiProfiles.js';
import { ThreeBoard } from './render/threeBoard.js';
import { TwoDBoard } from './render/twoDBoard.js';
import { GameTreeVisualizer } from './ui/treeVisualizer.js';
import { DashboardUI } from './ui/dashboard.js';
import { TrainerModal } from './ui/trainerModal.js';
import { TradeModal } from './ui/tradeModal.js';
import { soundManager } from './audio/soundManager.js';

class MonopolyApp {
  constructor() {
    this.speed = 1; // 1x, 2x, 5x, 20x
    this.searchDepth = 3;
    this.viewMode = '3d'; // '3d' or '2d'
    this.gameMode = 'human_vs_ai'; // 'human_vs_ai', 'ai_vs_ai', 'ai_4p'
    this.isProcessingAITurn = false;
    this.aiEngines = {}; // playerId -> ExpectiminimaxEngine

    this.init();
  }

  init() {
    // 1. Create Game State
    this.setupGameState();

    // 2. Setup Renderers
    const threeContainer = document.getElementById('three-container');
    const twodContainer = document.getElementById('twod-container');
    const treeWrap = document.getElementById('tree-canvas-wrap');

    const inspectTile = tileIndex => {
      const square = tileIndex === null ? null : BoardSquares[tileIndex];
      document.getElementById('board-tile-info').textContent = square
        ? `${square.name}${square.price ? ` · $${square.price}` : ''}${square.taxAmount ? ` · Pay $${square.taxAmount}` : ''}`
        : 'Point to a tile to see its name. Select a property for its deed.';
    };
    this.threeBoard = new ThreeBoard(threeContainer, (tileIdx) => this.handleTileClick(tileIdx), inspectTile);
    this.twoDBoard = new TwoDBoard(twodContainer, (tileIdx) => this.handleTileClick(tileIdx), inspectTile);
    this.treeVisualizer = new GameTreeVisualizer(treeWrap);

    // 3. Setup UI & Modals
    this.dashboard = new DashboardUI({
      game: this.game,
      threeBoard: this.threeBoard,
      treeVisualizer: this.treeVisualizer,
      onAction: (act) => this.handleUIAction(act)
    });

    const trainerWrap = document.getElementById('trainer-modal-container');
    this.trainerModal = new TrainerModal(trainerWrap, (newWeights) => {
      // Re-init Minimax engines with updated weights
      this.reinitAIEngines();
      this.dashboard.showToast('Updated AI weights applied to game!', 'success');
    });

    const tradeWrap = document.getElementById('trade-modal-container');
    this.tradeModal = new TradeModal(tradeWrap, this.game, this.aiEngines[0], () => {
      this.dashboard.updateAll();
    });

    // 4. Initial Render
    this.threeBoard.initPlayers(this.game.players);
    this.twoDBoard.updatePlayers(this.game.players);
    this.twoDBoard.updateProperties(this.game.properties, this.game.players);

    // 5. Setup Top Bar Events
    this.bindHeaderEvents();
    this.bindHumanActionEvents();

    // 6. Check if AI starts turn
    this.checkTurnExecution();
  }

  setupGameState() {
    let playerConfigs = [];

    if (this.gameMode === 'human_vs_ai') {
      playerConfigs = [
        { id: 0, name: 'AI Minimax', type: 'ai', profile: 'minimax', color: '#a9863f', avatar: 'hat' },
        { id: 1, name: 'You (Human)', type: 'human', profile: 'human', color: '#a03123', avatar: 'car' }
      ];
    } else if (this.gameMode === 'ai_vs_ai') {
      playerConfigs = [
        { id: 0, name: 'Minimax Grandmaster', type: 'ai', profile: 'minimax', color: '#a9863f', avatar: 'hat' },
        { id: 1, name: 'Aggressive Monopolist', type: 'ai', profile: 'aggressive', color: '#a03123', avatar: 'car' }
      ];
    } else {
      // 4-player AI battle
      playerConfigs = [
        { id: 0, name: 'Minimax AI', type: 'ai', profile: 'minimax', color: '#a9863f', avatar: 'hat' },
        { id: 1, name: 'Aggressive AI', type: 'ai', profile: 'aggressive', color: '#a03123', avatar: 'car' },
        { id: 2, name: 'Cautious AI', type: 'ai', profile: 'cautious', color: '#2f5d43', avatar: 'ship' },
        { id: 3, name: 'Transit Baron', type: 'ai', profile: 'baron', color: '#2d4a63', avatar: 'pawn' }
      ];
    }

    this.game = new GameState({
      winTarget: 4000,
      startingCash: 1500,
      players: playerConfigs
    });

    this.reinitAIEngines();
  }

  reinitAIEngines() {
    this.aiEngines = {};
    this.game.players.forEach(p => {
      if (p.type === 'ai') {
        const profile = AIProfiles[p.profile] || AIProfiles.minimax;
        const evaluator = new HeuristicEvaluator(profile.weights);
        this.aiEngines[p.id] = new ExpectiminimaxEngine(evaluator, this.searchDepth);
      }
    });
  }

  bindHeaderEvents() {
    document.getElementById('ai-depth-select').addEventListener('change', event => {
      this.searchDepth = Number(event.target.value);
      Object.values(this.aiEngines).forEach(engine => engine.setDepth(this.searchDepth));
      this.treeVisualizer.setTree(null, `${this.searchDepth}-ply lookahead is ready. The next AI buying decision will use this depth.`);
    });

    // Game Mode Select
    const modeSelect = document.getElementById('game-mode-select');
    modeSelect?.addEventListener('change', (e) => {
      this.gameMode = e.target.value;
      this.restartGame();
    });

    // Speed Controls
    document.querySelectorAll('#speed-btn-group .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#speed-btn-group .btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.speed = parseInt(btn.getAttribute('data-speed'), 10);
      });
    });

    // 3D vs 2D View Toggle
    const btn3d = document.getElementById('btn-toggle-3d');
    const btn2d = document.getElementById('btn-toggle-2d');
    const camBox = document.getElementById('cam-toggles-box');
    const threeContainer = document.getElementById('three-container');
    const twodContainer = document.getElementById('twod-container');

    btn3d?.addEventListener('click', () => {
      this.viewMode = '3d';
      btn3d.classList.add('active');
      btn2d.classList.remove('active');
      camBox?.classList.remove('hidden');
      threeContainer?.classList.remove('hidden');
      twodContainer?.classList.add('hidden');
      this.threeBoard.onResize();
    });

    btn2d?.addEventListener('click', () => {
      this.viewMode = '2d';
      btn2d.classList.add('active');
      btn3d.classList.remove('active');
      camBox?.classList.add('hidden');
      twodContainer?.classList.remove('hidden');
      threeContainer?.classList.add('hidden');
      this.twoDBoard.updatePlayers(this.game.players);
      this.twoDBoard.updateProperties(this.game.properties, this.game.players);
      this.twoDBoard.resize();
    });

    document.getElementById('btn-board-zoom-in').addEventListener('click', () => {
      (this.viewMode === '3d' ? this.threeBoard : this.twoDBoard).zoomBy(0.8);
    });
    document.getElementById('btn-board-zoom-out').addEventListener('click', () => {
      (this.viewMode === '3d' ? this.threeBoard : this.twoDBoard).zoomBy(1.25);
    });
    document.getElementById('btn-board-fit').addEventListener('click', () => {
      if (this.viewMode === '3d') this.threeBoard.setCameraPreset(this.threeBoard.cameraMode);
      else this.twoDBoard.fit();
    });

    // Camera Presets
    document.getElementById('btn-cam-iso')?.addEventListener('click', (e) => {
      this.threeBoard.setCameraPreset('isometric');
      document.querySelectorAll('#cam-toggles-box .btn-icon').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });

    document.getElementById('btn-cam-top')?.addEventListener('click', (e) => {
      this.threeBoard.setCameraPreset('topDown');
      document.querySelectorAll('#cam-toggles-box .btn-icon').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });

    // AI Lab Button
    document.getElementById('btn-open-trainer')?.addEventListener('click', () => {
      this.trainerModal.open();
    });

    // Audio Toggle
    document.getElementById('btn-toggle-audio')?.addEventListener('click', (e) => {
      const enabled = soundManager.toggleSound();
      e.currentTarget.classList.toggle('is-muted', !enabled);
    });

    // Rules Modal
    document.getElementById('btn-rules')?.addEventListener('click', () => {
      document.getElementById('rules-modal')?.classList.add('open');
    });
    document.getElementById('btn-close-rules')?.addEventListener('click', () => {
      document.getElementById('rules-modal')?.classList.remove('open');
    });

    // Reset Match
    document.getElementById('btn-reset-game')?.addEventListener('click', () => {
      this.restartGame();
    });
  }

  bindHumanActionEvents() {
    // Roll Dice button
    document.getElementById('btn-roll')?.addEventListener('click', () => {
      this.executeHumanRoll();
    });

    // End Turn button
    document.getElementById('btn-end-turn')?.addEventListener('click', () => {
      this.game.endTurn();
      this.dashboard.updateAll();
      this.checkTurnExecution();
    });

    // Trade button
    document.getElementById('btn-trade')?.addEventListener('click', () => {
      this.tradeModal.open();
    });

    // Buy Decision Prompt Buttons
    document.getElementById('btn-confirm-buy')?.addEventListener('click', () => {
      const promptBox = document.getElementById('buy-prompt-box');
      promptBox?.classList.add('hidden');

      const activeP = this.game.getActivePlayer();
      soundManager.playBuy();
      this.game.buyProperty(activeP.id, activeP.position);
      this.dashboard.updateAll();
    });

    document.getElementById('btn-decline-buy')?.addEventListener('click', () => {
      document.getElementById('buy-prompt-box')?.classList.add('hidden');
      this.dashboard.setThoughtStream('Player passed on buying property.');
    });

    // Close Deed Modal
    document.getElementById('btn-close-deed')?.addEventListener('click', () => {
      this.dashboard.closeDeedModal();
    });
  }

  handleTileClick(tileIndex) {
    this.dashboard.openDeedModal(tileIndex);
  }

  handleUIAction(action) {
    if (action === 'restart') {
      this.restartGame();
    }
  }

  restartGame() {
    this.setupGameState();
    this.dashboard.game = this.game;
    this.tradeModal.game = this.game;
    this.tradeModal.aiEngine = this.aiEngines[0] || Object.values(this.aiEngines)[0];

    this.threeBoard.initPlayers(this.game.players);
    this.threeBoard.updatePropertyOwnership(0, null);
    this.twoDBoard.updatePlayers(this.game.players);
    this.twoDBoard.updateProperties(this.game.properties, this.game.players);

    this.dashboard.updateAll();
    this.dashboard.setThoughtStream('New match initialized! Ready for opening rolls.');
    this.treeVisualizer.setTree(null);
    this.checkTurnExecution();
  }

  // Check if current turn belongs to AI
  checkTurnExecution() {
    if (this.game.winner !== null) return;

    const activeP = this.game.getActivePlayer();
    if (activeP.type === 'ai') {
      const delay = this.speed >= 20 ? 10 : Math.max(80, 700 / this.speed);
      setTimeout(() => this.executeAITurn(), delay);
    }
  }

  // Human player rolls dice
  executeHumanRoll() {
    const activeP = this.game.getActivePlayer();
    if (activeP.type !== 'human' || this.game.phase !== 'roll') return;

    const oldPos = activeP.position;
    const rollRes = this.game.rollDice();
    if (!rollRes) return;

    const steps = rollRes.dice[0] + rollRes.dice[1];
    const newPos = activeP.position;

    // Roll 3D Dice and animate token hop
    if (this.speed < 20) {
      this.threeBoard.roll3DDice(rollRes.dice[0], rollRes.dice[1], () => {
        this.threeBoard.animateMovePlayer(activeP.id, oldPos, newPos, steps, () => {
          this.handleHumanPostLand(newPos);
        });
      });
    } else {
      this.handleHumanPostLand(newPos);
    }

    this.twoDBoard.updatePlayers(this.game.players);
    this.dashboard.updateAll();
  }

  handleHumanPostLand(tileIndex) {
    const activeP = this.game.getActivePlayer();
    const sq = BoardSquares[tileIndex];
    const prop = this.game.properties[tileIndex];

    // If landed on unowned property and can afford
    if (prop && prop.owner === null && activeP.money >= sq.price) {
      const promptBox = document.getElementById('buy-prompt-box');
      document.getElementById('buy-prompt-name').textContent = sq.name;
      document.getElementById('buy-prompt-price').textContent = `Unowned · Price $${sq.price} — your cash $${activeP.money.toLocaleString()}`;
      promptBox?.classList.remove('hidden');
    }

    this.twoDBoard.updateProperties(this.game.properties, this.game.players);
    this.dashboard.updateAll();
  }

  // Execute Complete AI Turn using Expectiminimax Game Tree
  async executeAITurn() {
    if (this.isProcessingAITurn || this.game.winner !== null) return;
    this.isProcessingAITurn = true;

    const activeP = this.game.getActivePlayer();
    if (activeP.type !== 'ai') {
      this.isProcessingAITurn = false;
      return;
    }

    const engine = this.aiEngines[activeP.id];
    if (!engine) {
      this.isProcessingAITurn = false;
      return;
    }

    const stepDelay = (ms) => new Promise(r => setTimeout(r, this.speed >= 20 ? 0 : ms / this.speed));

    // 1. Jail Decision
    if (activeP.inJail) {
      const jailDecision = engine.decideJailAction(this.game, activeP.id);
      if (jailDecision === 'card' && activeP.getOutOfJailCards > 0) {
        this.dashboard.setThoughtStream(`${activeP.name} decided to use Get Out of Jail Free card.`);
        this.game.releaseFromJail(activeP.id, 'card');
      } else if (jailDecision === 'pay' && activeP.money >= 50) {
        this.dashboard.setThoughtStream(`${activeP.name} evaluated paying $50 fine as optimal to exit jail.`);
        this.game.releaseFromJail(activeP.id, 'pay');
      } else {
        this.dashboard.setThoughtStream(`${activeP.name} decided to roll for doubles (free exit).`);
      }
      await stepDelay(300);
    }

    // 2. Pre-roll House/Hotel Upgrades
    const upgrades = engine.decideUpgrades(this.game, activeP.id);
    for (const tileIndex of upgrades) {
      const sq = BoardSquares[tileIndex];
      this.dashboard.setThoughtStream(`${activeP.name} evaluated building upgrade on ${sq.name} for high rental ROI.`);
      soundManager.playBuildHouse();
      this.game.buildHouse(activeP.id, tileIndex);
      this.dashboard.updateAll();
      await stepDelay(250);
    }

    // 3. Roll Dice
    const oldPos = activeP.position;
    const rollRes = this.game.rollDice();
    if (!rollRes || this.game.winner !== null) {
      this.isProcessingAITurn = false;
      return;
    }

    const [d1, d2] = rollRes.dice;
    const steps = d1 + d2;
    const newPos = activeP.position;

    // Animate 3D Dice roll & Token Hopping
    if (this.speed < 20) {
      await new Promise(resolve => {
        this.threeBoard.roll3DDice(d1, d2, () => {
          this.threeBoard.animateMovePlayer(activeP.id, oldPos, newPos, steps, resolve);
        });
      });
    }

    this.twoDBoard.updatePlayers(this.game.players);
    this.dashboard.updateAll();
    await stepDelay(250);

    // 4. Post-roll Buy Decision via Expectiminimax
    const currentTile = activeP.position;
    const prop = this.game.properties[currentTile];
    const sq = BoardSquares[currentTile];

    if (prop && prop.owner === null) {
      this.dashboard.setThoughtStream(`${activeP.name} analyzing Game Tree for ${sq.name}...`);
      await stepDelay(200);

      // Run Expectiminimax Game Tree Search
      const buyDecision = engine.decideBuy(this.game, activeP.id, currentTile);

      // Feed decision tree to the visualizer!
      this.treeVisualizer.setTree(buyDecision.tree, buyDecision.reason);
      this.dashboard.setThoughtStream(buyDecision.reason);

      if (buyDecision.action === 'buy') {
        soundManager.playBuy();
        this.game.buyProperty(activeP.id, currentTile);
      }
      this.dashboard.updateAll();
      await stepDelay(400);
    }

    // 5. Unmortgage if rich
    const unmortgageList = engine.decideUnmortgage(this.game, activeP.id);
    unmortgageList.forEach(idx => {
      this.game.unmortgageProperty(activeP.id, idx);
    });

    this.twoDBoard.updateProperties(this.game.properties, this.game.players);
    this.dashboard.updateAll();
    await stepDelay(300);

    // 6. End AI Turn
    this.game.endTurn();
    this.dashboard.updateAll();
    this.isProcessingAITurn = false;

    // Continue loop
    this.checkTurnExecution();
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new MonopolyApp();
});
