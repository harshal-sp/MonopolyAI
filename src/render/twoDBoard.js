import { BoardSquares, ColorGroups, TileTypes, getTileGridCoords } from '../engine/boardData.js';
import { tokenSVG } from '../ui/tokens.js';

// Small drawn glyphs for special tiles — one stroke weight, currentColor
const TILE_GLYPHS = {
  railroad: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="4" width="12" height="12" rx="2.5"/>
    <path d="M6.5 12h11M9 4v8M15 4v8"/>
    <circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/>
  </svg>`,
  electric: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 2L4.5 13.5H11L9.5 22 19 10h-6.5z"/>
  </svg>`,
  water: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>
  </svg>`,
  tax: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.7 0-3 .9-3 2.1 0 2.8 6 1.4 6 4.2 0 1.2-1.3 2.1-3 2.1-1.2 0-2.3-.5-2.8-1.4M12 6v2M12 16v2"/>
  </svg>`
};

export class TwoDBoard {
  constructor(containerEl, onTileClick = null, onTileHover = null) {
    this.container = containerEl;
    this.onTileClick = onTileClick;
    this.onTileHover = onTileHover;
    this.zoom = 1;
    this.tileEls = [];
    this.playerPins = [];

    this.render();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  render() {
    this.container.innerHTML = `
      <div class="board-2d-wrapper">
        <div class="board-2d-space">
        <div class="board-2d-grid" id="board-2d-grid">
          <!-- 40 perimeter tiles + center area -->
          <div class="board-2d-center">
            <div class="center-banner">
              <span class="center-title">MONOPOLY AI</span>
              <span class="center-subtitle">Expectiminimax Engine</span>
            </div>
            <div class="center-decks">
              <div class="deck-box chance-deck">CHANCE</div>
              <div class="deck-box cc-deck">COMMUNITY CHEST</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    `;

    const grid = document.getElementById('board-2d-grid');
    this.tileEls = [];

    // Create 40 tiles and position them on the 11x11 grid using CSS grid-column and grid-row
    for (let i = 0; i < 40; i++) {
      const sq = BoardSquares[i];
      const coords = getTileGridCoords(i);
      // CSS grid is 1-indexed (row 1..11, col 1..11)
      const gridRow = coords.row + 1;
      const gridCol = coords.col + 1;

      const tileEl = document.createElement('div');
      tileEl.className = `tile-2d tile-${coords.side} ${sq.type}`;
      tileEl.style.gridRow = `${gridRow}`;
      tileEl.style.gridColumn = `${gridCol}`;
      tileEl.setAttribute('data-tile', i);
      tileEl.title = `${sq.name}${sq.price ? ` · $${sq.price}` : ''}`;
      tileEl.setAttribute('aria-label', tileEl.title);
      tileEl.setAttribute('role', 'button');
      tileEl.tabIndex = 0;

      const group = ColorGroups[sq.group?.toUpperCase()];
      const bannerColor = group ? group.color : null;

      let innerHtml = '';
      const shortName = sq.name.replace(/Avenue/g, 'Ave.').replace(/Railroad/g, 'RR').replace(/North Carolina/g, 'N. Carolina');
      if (sq.type === TileTypes.PROPERTY && bannerColor) {
        innerHtml = `
          <div class="tile-2d-color-bar" style="background:${bannerColor}"></div>
          <div class="tile-2d-content">
            <div class="tile-2d-name">${shortName}</div>
            <div class="tile-2d-houses" id="tile-2d-houses-${i}"></div>
            <div class="tile-2d-price">$${sq.price}</div>
          </div>
        `;
      } else {
        const glyph =
          sq.type === TileTypes.RAILROAD ? TILE_GLYPHS.railroad :
          sq.type === TileTypes.UTILITY ? (i === 12 ? TILE_GLYPHS.electric : TILE_GLYPHS.water) :
          sq.type === TileTypes.TAX ? TILE_GLYPHS.tax : '';
        innerHtml = `
          <div class="tile-2d-content corner-or-special">
            <div class="tile-icon">${glyph}</div>
            <div class="tile-2d-name">${shortName}</div>
            ${sq.type === TileTypes.RAILROAD || sq.type === TileTypes.UTILITY ? `<div class="tile-2d-price">$${sq.price}</div>` : ''}
            ${sq.type === TileTypes.TAX ? `<div class="tile-2d-price">Pay $${sq.taxAmount}</div>` : ''}
          </div>
        `;
      }

      innerHtml += `<div class="tile-2d-tokens" id="tile-2d-tokens-${i}"></div>`;
      tileEl.innerHTML = innerHtml;

      tileEl.addEventListener('click', () => {
        if (this.onTileClick) this.onTileClick(i);
      });
      tileEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onTileClick?.(i);
        }
      });
      tileEl.addEventListener('pointerenter', () => this.onTileHover?.(i));
      tileEl.addEventListener('focus', () => this.onTileHover?.(i));

      grid.appendChild(tileEl);
      this.tileEls.push(tileEl);
    }
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    // Lay out legible tiles once at 720px, then scale the whole board. Reflowing
    // each tile at viewport size was clipping long names and prices.
    const size = Math.max(1, Math.min(width - 32, height - 32)) * this.zoom;
    this.container.style.setProperty('--board-size', `${size}px`);
    this.container.style.setProperty('--board-scale', size / 720);
  }

  zoomBy(factor) {
    this.zoom = Math.max(0.75, Math.min(2.5, this.zoom / factor));
    this.resize();
  }

  fit() {
    this.zoom = 1;
    this.resize();
    this.container.querySelector('.board-2d-wrapper').scrollTo(0, 0);
  }

  // Update players and tokens on 2D board
  updatePlayers(players) {
    // Clear all tokens
    for (let i = 0; i < 40; i++) {
      const container = document.getElementById(`tile-2d-tokens-${i}`);
      if (container) container.innerHTML = '';
    }

    players.forEach(p => {
      if (p.bankrupt) return;
      const container = document.getElementById(`tile-2d-tokens-${p.position}`);
      if (container) {
        const pin = document.createElement('span');
        pin.className = 'player-2d-pin';
        pin.style.setProperty('--pin', p.color);
        pin.title = p.name;
        pin.innerHTML = tokenSVG(p.avatar, p.color, 11);
        container.appendChild(pin);
      }
    });
  }

  // Update property ownership borders and houses
  updateProperties(properties, players) {
    for (const idx in properties) {
      const prop = properties[idx];
      const tileEl = this.tileEls[idx];
      if (!tileEl) continue;

      if (prop.owner !== null) {
        const owner = players[prop.owner];
        tileEl.style.boxShadow = `inset 0 0 0 2px ${owner.color}`;
      } else {
        tileEl.style.boxShadow = 'none';
      }

      // Houses
      const houseEl = document.getElementById(`tile-2d-houses-${idx}`);
      if (houseEl) {
        if (prop.hotel) {
          houseEl.innerHTML = '<span class="hotel-mark"></span>';
        } else if (prop.houses > 0) {
          houseEl.innerHTML = '<span class="house-mark"></span>'.repeat(prop.houses);
        } else {
          houseEl.innerHTML = '';
        }
      }
    }
  }
}
