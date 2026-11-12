import { BoardSquares, ColorGroups, TileTypes } from '../engine/boardData.js';
import { AIProfiles } from '../ai/aiProfiles.js';
import { soundManager } from '../audio/soundManager.js';
import { tokenSVG } from './tokens.js';
import confetti from 'canvas-confetti';

export class DashboardUI {
  constructor({ game, threeBoard, treeVisualizer, onAction }) {
    this.game = game;
    this.board = threeBoard;
    this.treeVisualizer = treeVisualizer;
    this.onAction = onAction;

    this.selectedPropertyIndex = null;
    this.activeTrade = { offerMoney: 0, offerProps: [], requestMoney: 0, requestProps: [] };

    this.bindEvents();
    this.updateAll();
  }

  bindEvents() {
    // Listen to game engine events
    this.game.on('log', () => this.updateLog());
    this.game.on('turnChanged', () => this.updateTurn());
    this.game.on('moneyChanged', () => this.updatePlayers());
    this.game.on('rentPaid', () => this.updatePlayers());
    this.game.on('propertyBought', () => {
      this.updatePlayers();
      this.updateBoardVisuals();
    });
    this.game.on('houseBuilt', () => {
      this.updatePlayers();
      this.updateBoardVisuals();
    });
    this.game.on('houseSold', () => {
      this.updatePlayers();
      this.updateBoardVisuals();
    });
    this.game.on('propertyMortgaged', () => {
      this.updatePlayers();
      this.updateBoardVisuals();
    });
    this.game.on('propertyUnmortgaged', () => {
      this.updatePlayers();
      this.updateBoardVisuals();
    });
    this.game.on('bankruptcy', (data) => {
      soundManager.playBankruptcy();
      this.updatePlayers();
      this.showToast(`${data.player.name} has gone bankrupt.`, 'danger');
    });
    this.game.on('gameOver', (data) => {
      soundManager.playWin();
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#c9a45c', '#a03123', '#2f5d43', '#f6efdd']
      });
      this.showGameOverModal(data.winner, data.reason);
    });
  }

  updateAll() {
    this.updatePlayers();
    this.updateTurn();
    this.updateLog();
    this.updateBoardVisuals();
  }

  updateTurn() {
    const activeP = this.game.getActivePlayer();
    const banner = document.getElementById('turn-banner');
    if (banner) {
      banner.innerHTML = `
        <span class="avatar-badge" style="background:${activeP.color}22; border-color:${activeP.color}">
          ${tokenSVG(activeP.avatar, activeP.color, 20)}
        </span>
        <div class="turn-info">
          <div class="turn-title">${activeP.name}'s Turn</div>
          <div class="turn-sub">${activeP.type === 'ai' ? 'Evaluating the game tree…' : 'Your move — roll, build, or trade.'}</div>
        </div>
      `;
    }

    // Toggle roll button based on whether active player is human and phase is 'roll'
    const rollBtn = document.getElementById('btn-roll');
    if (rollBtn) {
      rollBtn.disabled = activeP.type === 'ai' || this.game.phase !== 'roll' || this.game.winner !== null;
    }

    const endTurnBtn = document.getElementById('btn-end-turn');
    if (endTurnBtn) {
      endTurnBtn.disabled = activeP.type === 'ai' || this.game.phase !== 'action' || this.game.winner !== null;
    }

    const tradeBtn = document.getElementById('btn-trade');
    if (tradeBtn) {
      tradeBtn.disabled = activeP.type === 'ai' || this.game.winner !== null;
    }
  }

  updatePlayers() {
    const container = document.getElementById('players-list');
    if (!container) return;

    container.innerHTML = '';
    this.game.players.forEach(p => {
      const isTurn = p.id === this.game.turn;
      const netWorth = this.game.getPlayerNetWorth(p.id);

      // Count owned properties
      const ownedProps = Object.values(this.game.properties).filter(prop => prop.owner === p.id);

      // Monopolies
      const monopolies = [];
      for (const key in ColorGroups) {
        const group = ColorGroups[key];
        if (group.housePrice > 0 && this.game.ownsEntireGroup(p.id, group.id)) {
          monopolies.push(group);
        }
      }

      const card = document.createElement('div');
      card.className = `player-card ${isTurn ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}`;

      card.innerHTML = `
        <div class="player-header">
          <div class="player-identity">
            <span class="player-avatar">${tokenSVG(p.avatar, p.color, 19)}</span>
            <div>
              <div class="player-name">${p.name} ${isTurn ? '<span class="turn-pill">TURN</span>' : ''}</div>
              <div class="player-type">${p.type === 'ai' ? `AI · ${AIProfiles[p.profile]?.name || 'Agent'}` : 'Player'}</div>
            </div>
          </div>
          <div class="player-cash">$${p.money.toLocaleString()}</div>
        </div>

        <div class="player-stats-row">
          <span>Net worth <strong>$${netWorth.toLocaleString()}</strong></span>
          <span>Properties <strong>${ownedProps.length}</strong></span>
          ${p.inJail ? '<span class="status-jail">IN JAIL</span>' : ''}
        </div>

        ${monopolies.length > 0 ? `
          <div class="monopoly-tags">
            ${monopolies.map(m => `<span class="monopoly-tag" style="background:${m.color}1c; color:${m.color}; border-color:${m.color}88;">★ ${m.name}</span>`).join('')}
          </div>
        ` : ''}

        <div class="props-mini-list">
          ${ownedProps.map(prop => {
            const sq = BoardSquares[prop.index];
            const grp = ColorGroups[sq.group?.toUpperCase()];
            const bg = grp ? grp.color : '#6f6350';
            return `
              <span class="prop-badge ${prop.mortgaged ? 'mortgaged' : ''}"
                    style="--swatch:${bg}"
                    title="${sq.name} (${prop.houses} ${prop.hotel ? 'hotel' : 'houses'})"
                    data-tile="${prop.index}">
                ${prop.hotel ? 'Hotel' : prop.houses > 0 ? `${prop.houses} house${prop.houses > 1 ? 's' : ''}` : ''} ${sq.name}
              </span>
            `;
          }).join('')}
        </div>
      `;

      // Click on property badge to inspect deed
      card.querySelectorAll('.prop-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          const tileIdx = parseInt(badge.getAttribute('data-tile'), 10);
          this.openDeedModal(tileIdx);
        });
      });

      container.appendChild(card);
    });
  }

  updateBoardVisuals() {
    if (!this.board) return;

    for (const idx in this.game.properties) {
      const prop = this.game.properties[idx];
      const owner = prop.owner !== null ? this.game.players[prop.owner] : null;
      this.board.updatePropertyOwnership(parseInt(idx, 10), owner ? owner.color : null);
      this.board.updateBuilding(parseInt(idx, 10), prop.houses, prop.hotel);
    }
  }

  updateLog() {
    const logBox = document.getElementById('game-log');
    if (!logBox) return;

    logBox.innerHTML = '';
    const recent = this.game.history.slice(-25).reverse();

    recent.forEach(entry => {
      const div = document.createElement('div');
      div.className = `log-entry log-${entry.type || 'info'}`;
      div.innerHTML = `<span class="log-turn">T${entry.turn}</span> <span class="log-text">${entry.text}</span>`;
      logBox.appendChild(div);
    });
  }

  setThoughtStream(text) {
    const el = document.getElementById('ai-thought-text');
    if (el) {
      el.textContent = text;
      el.classList.remove('pulse-glow');
      void el.offsetWidth; // retrigger animation
      el.classList.add('pulse-glow');
    }
  }

  // Open authentic Property Deed Modal
  openDeedModal(tileIndex) {
    const sq = BoardSquares[tileIndex];
    if (!sq || (sq.type !== TileTypes.PROPERTY && sq.type !== TileTypes.RAILROAD && sq.type !== TileTypes.UTILITY)) {
      return;
    }

    this.selectedPropertyIndex = tileIndex;
    const prop = this.game.properties[tileIndex];
    const owner = prop.owner !== null ? this.game.players[prop.owner] : null;
    const activeP = this.game.getActivePlayer();
    const canManage = owner && owner.id === activeP.id && activeP.type === 'human' && this.game.winner === null;

    const modal = document.getElementById('deed-modal');
    const content = document.getElementById('deed-content');
    if (!modal || !content) return;

    const group = ColorGroups[sq.group?.toUpperCase()];
    const bannerColor = group ? group.color : '#4c4231';

    content.innerHTML = `
      <div class="deed-card">
        <div class="deed-header" style="background:${bannerColor}">
          <div class="deed-type">Title Deed</div>
          <div class="deed-name">${sq.name}</div>
        </div>

        <div class="deed-body">
          ${sq.type === TileTypes.PROPERTY ? `
            <div class="deed-row"><span>Rent</span> <strong>$${sq.baseRent}</strong></div>
            <div class="deed-row ${prop.houses === 1 ? 'highlight-rent' : ''}"><span>With 1 house</span> <strong>$${sq.rent[1]}</strong></div>
            <div class="deed-row ${prop.houses === 2 ? 'highlight-rent' : ''}"><span>With 2 houses</span> <strong>$${sq.rent[2]}</strong></div>
            <div class="deed-row ${prop.houses === 3 ? 'highlight-rent' : ''}"><span>With 3 houses</span> <strong>$${sq.rent[3]}</strong></div>
            <div class="deed-row ${prop.houses === 4 ? 'highlight-rent' : ''}"><span>With 4 houses</span> <strong>$${sq.rent[4]}</strong></div>
            <div class="deed-row ${prop.hotel ? 'highlight-rent' : ''}"><span>With hotel</span> <strong>$${sq.rent[5]}</strong></div>
            <div class="deed-divider"></div>
            <div class="deed-row"><span>Mortgage value</span> <strong>$${sq.mortgage}</strong></div>
            <div class="deed-row"><span>Houses cost</span> <strong>$${sq.housePrice} each</strong></div>
          ` : sq.type === TileTypes.RAILROAD ? `
            <div class="deed-row"><span>Rent</span> <strong>$25</strong></div>
            <div class="deed-row"><span>If 2 railroads owned</span> <strong>$50</strong></div>
            <div class="deed-row"><span>If 3 railroads owned</span> <strong>$100</strong></div>
            <div class="deed-row"><span>If 4 railroads owned</span> <strong>$200</strong></div>
            <div class="deed-divider"></div>
            <div class="deed-row"><span>Mortgage value</span> <strong>$${sq.mortgage}</strong></div>
          ` : `
            <div class="deed-desc">If one utility is owned, rent is 4 times the amount on the dice. If both are owned, rent is 10 times the amount on the dice.</div>
            <div class="deed-divider"></div>
            <div class="deed-row"><span>Mortgage value</span> <strong>$${sq.mortgage}</strong></div>
          `}

          <div class="deed-ownership-status">
            ${owner ? `Owned by <strong style="color:${owner.color}">${owner.name}</strong>${prop.mortgaged ? ' · mortgaged' : ''}` : '<span class="status-unowned">Unowned — held by the bank</span>'}
          </div>
        </div>

        ${canManage ? `
          <div class="deed-actions">
            ${sq.type === TileTypes.PROPERTY && !prop.mortgaged ? `
              <button class="btn btn-sm btn-success" id="deed-build-house" ${prop.houses >= 5 || activeP.money < sq.housePrice ? 'disabled' : ''}>
                Build house ($${sq.housePrice})
              </button>
              <button class="btn btn-sm btn-secondary" id="deed-sell-house" ${prop.houses <= 0 ? 'disabled' : ''}>
                Sell house (+$${Math.floor(sq.housePrice / 2)})
              </button>
            ` : ''}
            ${!prop.mortgaged ? `
              <button class="btn btn-sm btn-danger" id="deed-mortgage" ${prop.houses > 0 ? 'disabled' : ''}>
                Mortgage (+$${sq.mortgage})
              </button>
            ` : `
              <button class="btn btn-sm btn-info" id="deed-unmortgage" ${activeP.money < Math.floor(sq.mortgage * 1.1) ? 'disabled' : ''}>
                Lift mortgage (−$${Math.floor(sq.mortgage * 1.1)})
              </button>
            `}
          </div>
        ` : ''}
      </div>
    `;

    // Hook deed action buttons
    const buildBtn = document.getElementById('deed-build-house');
    if (buildBtn) {
      buildBtn.addEventListener('click', () => {
        soundManager.playBuildHouse();
        this.game.buildHouse(activeP.id, tileIndex);
        this.openDeedModal(tileIndex);
      });
    }

    const sellBtn = document.getElementById('deed-sell-house');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        this.game.sellHouse(activeP.id, tileIndex);
        this.openDeedModal(tileIndex);
      });
    }

    const mortBtn = document.getElementById('deed-mortgage');
    if (mortBtn) {
      mortBtn.addEventListener('click', () => {
        this.game.mortgageProperty(activeP.id, tileIndex);
        this.openDeedModal(tileIndex);
      });
    }

    const unmortBtn = document.getElementById('deed-unmortgage');
    if (unmortBtn) {
      unmortBtn.addEventListener('click', () => {
        this.game.unmortgageProperty(activeP.id, tileIndex);
        this.openDeedModal(tileIndex);
      });
    }

    modal.classList.add('open');
  }

  closeDeedModal() {
    const modal = document.getElementById('deed-modal');
    if (modal) modal.classList.remove('open');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  showGameOverModal(winner, reason) {
    const modal = document.getElementById('gameover-modal');
    const content = document.getElementById('gameover-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="winner-medal">
        <svg width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8.5" r="5.5"/>
          <path d="M8.6 13.2L7 22l5-2.6L17 22l-1.6-8.8"/>
        </svg>
      </div>
      <div class="gameover-title">VICTORY</div>
      <div class="winner-name" style="color:${winner.color}">${winner.name} takes the table</div>
      <p class="winner-desc">${reason === 'target_balance' ? `Target balance of $${this.game.winTarget.toLocaleString()} achieved.` : 'Every opponent was driven into bankruptcy.'}</p>

      <div class="final-stats-grid">
        <div class="stat-box">
          <div class="stat-val">$${winner.money.toLocaleString()}</div>
          <div class="stat-lbl">Final Cash</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">$${this.game.getPlayerNetWorth(winner.id).toLocaleString()}</div>
          <div class="stat-lbl">Net Worth</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${winner.stats.turnsPlayed}</div>
          <div class="stat-lbl">Turns</div>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" id="btn-restart-game">Play Again</button>
    `;

    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
      modal.classList.remove('open');
      if (this.onAction) this.onAction('restart');
    });

    modal.classList.add('open');
  }
}
