import { BoardSquares, ColorGroups } from '../engine/boardData.js';
import { soundManager } from '../audio/soundManager.js';

export class TradeModal {
  constructor(containerEl, game, aiEngine, onTradeExecuted = null) {
    this.container = containerEl;
    this.game = game;
    this.aiEngine = aiEngine;
    this.onTradeExecuted = onTradeExecuted;

    this.selectedPartnerId = null;
    this.offerMoney = 0;
    this.offerProps = new Set();
    this.requestMoney = 0;
    this.requestProps = new Set();

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="trade-modal">
        <div class="modal-panel trade-panel">
          <div class="modal-header">
            <div class="modal-title">
              <div>
                <h3>Propose a Trade</h3>
                <p>Negotiate deeds and cash with the other side of the table</p>
              </div>
            </div>
            <button class="modal-close" id="btn-close-trade" aria-label="Close trade"><svg width="16" height="16"><use href="#i-close"/></svg></button>
          </div>

          <div class="trade-partner-select">
            <label for="trade-partner-select">Trade partner:</label>
            <select id="trade-partner-select" class="select-input"></select>
          </div>

          <div class="trade-grid">
            <!-- Left: You Offer -->
            <div class="trade-column" id="trade-offer-col">
              <h4>You Offer</h4>
              <div class="trade-cash-input">
                <label>Cash Offer ($):</label>
                <input type="number" id="trade-offer-cash" min="0" value="0" step="50" class="num-input">
              </div>
              <div class="trade-prop-list" id="trade-my-props"></div>
            </div>

            <!-- Right: You Request -->
            <div class="trade-column" id="trade-request-col">
              <h4>You Request</h4>
              <div class="trade-cash-input">
                <label>Cash Request ($):</label>
                <input type="number" id="trade-request-cash" min="0" value="0" step="50" class="num-input">
              </div>
              <div class="trade-prop-list" id="trade-partner-props"></div>
            </div>
          </div>

          <!-- AI Evaluation Feedback Box -->
          <div class="ai-trade-feedback hidden" id="trade-feedback"></div>

          <div class="trade-actions">
            <button class="btn btn-secondary" id="btn-cancel-trade">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-trade"><svg width="15" height="15"><use href="#i-exchange"/></svg> Propose to the Table</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    document.getElementById('btn-close-trade')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-trade')?.addEventListener('click', () => this.close());

    document.getElementById('trade-partner-select')?.addEventListener('change', (e) => {
      this.selectedPartnerId = parseInt(e.target.value, 10);
      this.requestProps.clear();
      this.populateProperties();
    });

    document.getElementById('trade-offer-cash')?.addEventListener('input', (e) => {
      this.offerMoney = Math.max(0, parseInt(e.target.value, 10) || 0);
    });

    document.getElementById('trade-request-cash')?.addEventListener('input', (e) => {
      this.requestMoney = Math.max(0, parseInt(e.target.value, 10) || 0);
    });

    document.getElementById('btn-submit-trade')?.addEventListener('click', () => {
      this.submitTrade();
    });
  }

  open() {
    const activeP = this.game.getActivePlayer();
    const partners = this.game.getAlivePlayers().filter(p => p.id !== activeP.id);
    if (partners.length === 0) return;

    const select = document.getElementById('trade-partner-select');
    select.innerHTML = partners.map(p => `
      <option value="${p.id}">${p.name} (Cash: $${p.money})</option>
    `).join('');

    this.selectedPartnerId = partners[0].id;
    this.offerProps.clear();
    this.requestProps.clear();
    this.offerMoney = 0;
    this.requestMoney = 0;
    document.getElementById('trade-offer-cash').value = 0;
    document.getElementById('trade-request-cash').value = 0;
    document.getElementById('trade-feedback').classList.add('hidden');

    this.populateProperties();
    document.getElementById('trade-modal')?.classList.add('open');
  }

  close() {
    document.getElementById('trade-modal')?.classList.remove('open');
  }

  populateProperties() {
    const activeP = this.game.getActivePlayer();
    const partner = this.game.players[this.selectedPartnerId];

    const myPropsEl = document.getElementById('trade-my-props');
    const partnerPropsEl = document.getElementById('trade-partner-props');

    // My properties
    const myProps = Object.values(this.game.properties).filter(p => p.owner === activeP.id && p.houses === 0);
    myPropsEl.innerHTML = myProps.length === 0 ? '<div class="no-props">No unbuilt properties to trade</div>' : myProps.map(p => {
      const sq = BoardSquares[p.index];
      const grp = ColorGroups[sq.group?.toUpperCase()];
      const isSelected = this.offerProps.has(p.index);
      return `
        <div class="trade-prop-item ${isSelected ? 'selected' : ''}" data-tile="${p.index}">
          <span class="prop-color-dot" style="background:${grp ? grp.color : '#94a3b8'}"></span>
          <span>${sq.name} ($${sq.price})</span>
        </div>
      `;
    }).join('');

    // Partner properties
    const partnerProps = Object.values(this.game.properties).filter(p => p.owner === partner.id && p.houses === 0);
    partnerPropsEl.innerHTML = partnerProps.length === 0 ? '<div class="no-props">Partner has no unbuilt properties</div>' : partnerProps.map(p => {
      const sq = BoardSquares[p.index];
      const grp = ColorGroups[sq.group?.toUpperCase()];
      const isSelected = this.requestProps.has(p.index);
      return `
        <div class="trade-prop-item ${isSelected ? 'selected' : ''}" data-tile="${p.index}">
          <span class="prop-color-dot" style="background:${grp ? grp.color : '#94a3b8'}"></span>
          <span>${sq.name} ($${sq.price})</span>
        </div>
      `;
    }).join('');

    // Click handlers
    myPropsEl.querySelectorAll('.trade-prop-item').forEach(el => {
      el.addEventListener('click', () => {
        const tileIdx = parseInt(el.getAttribute('data-tile'), 10);
        if (this.offerProps.has(tileIdx)) this.offerProps.delete(tileIdx);
        else this.offerProps.add(tileIdx);
        this.populateProperties();
      });
    });

    partnerPropsEl.querySelectorAll('.trade-prop-item').forEach(el => {
      el.addEventListener('click', () => {
        const tileIdx = parseInt(el.getAttribute('data-tile'), 10);
        if (this.requestProps.has(tileIdx)) this.requestProps.delete(tileIdx);
        else this.requestProps.add(tileIdx);
        this.populateProperties();
      });
    });
  }

  submitTrade() {
    const activeP = this.game.getActivePlayer();
    const partner = this.game.players[this.selectedPartnerId];
    const feedback = document.getElementById('trade-feedback');
    feedback.classList.remove('hidden');

    if (this.offerMoney > activeP.money) {
      feedback.className = 'ai-trade-feedback danger';
      feedback.innerHTML = `
        <span class="stamp">SHORT FUNDS</span>
        <p>You only hold $${activeP.money.toLocaleString()} in cash — lower the cash offer.</p>`;
      return;
    }
    if (this.requestMoney > partner.money) {
      feedback.className = 'ai-trade-feedback danger';
      feedback.innerHTML = `
        <span class="stamp">SHORT FUNDS</span>
        <p>${partner.name} only holds $${partner.money.toLocaleString()} in cash — lower your cash request.</p>`;
      return;
    }
    if (this.offerMoney === 0 && this.requestMoney === 0 && this.offerProps.size === 0 && this.requestProps.size === 0) {
      feedback.className = 'ai-trade-feedback danger';
      feedback.innerHTML = `
        <span class="stamp">EMPTY OFFER</span>
        <p>Add at least one deed or some cash to either side of the trade.</p>`;
      return;
    }

    const trade = {
      fromId: activeP.id,
      toId: partner.id,
      offerMoney: this.offerMoney,
      offerPropIndices: Array.from(this.offerProps),
      requestMoney: this.requestMoney,
      requestPropIndices: Array.from(this.requestProps)
    };

    // AI Partner evaluation using Expectiminimax
    const evalRes = this.aiEngine.evaluateTradeOffer(this.game, partner.id, trade);

    if (evalRes.accept) {
      soundManager.playBuy();
      feedback.className = 'ai-trade-feedback success';
      feedback.innerHTML = `
        <span class="stamp">ACCEPTED</span>
        <p>${partner.name} agrees: <em>${evalRes.reason}</em></p>
      `;

      this.game.executeTrade(trade);
      if (this.onTradeExecuted) this.onTradeExecuted(trade);

      setTimeout(() => {
        this.close();
      }, 1800);
    } else {
      soundManager.playBankruptcy();
      feedback.className = 'ai-trade-feedback danger';
      feedback.innerHTML = `
        <span class="stamp">DECLINED</span>
        <p>${partner.name} walks away: <em>${evalRes.reason}</em></p>
      `;
    }
  }
}
