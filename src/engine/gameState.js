import { BoardSquares, ColorGroups, TileTypes, ChanceCards, CommunityChestCards } from './boardData.js';

export class GameState {
  constructor(config = {}) {
    this.winTarget = config.winTarget || 4000; // Target balance to win (or 0 for bankruptcy only)
    this.startingCash = config.startingCash || 1500;
    this.salary = config.salary || 200;
    this.turn = 0;
    this.phase = 'roll'; // 'roll', 'action', 'game_over'
    this.dice = [1, 1];
    this.doublesCount = 0;
    this.lastLandedTile = null;
    this.turnCount = 1;
    this.winner = null;
    this.listeners = new Map();
    this.history = [];

    // Initialize players
    const defaultPlayers = [
      { id: 0, name: 'AI Alpha (Minimax)', type: 'ai', profile: 'minimax', color: '#38bdf8', avatar: '🤖' },
      { id: 1, name: 'Player 2 (Human)', type: 'human', profile: 'human', color: '#f43f5e', avatar: '🎩' }
    ];

    const playerConfigs = config.players || defaultPlayers;
    this.players = playerConfigs.map((p, idx) => ({
      id: idx,
      name: p.name || `Player ${idx + 1}`,
      type: p.type || 'ai',
      profile: p.profile || 'minimax',
      color: p.color || (idx === 0 ? '#38bdf8' : idx === 1 ? '#f43f5e' : idx === 2 ? '#10b981' : '#f59e0b'),
      avatar: p.avatar || ['🤖', '🎩', '🚗', '🚢'][idx % 4],
      money: this.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      stats: {
        rentPaid: 0,
        rentCollected: 0,
        propertiesBought: 0,
        turnsPlayed: 0,
        netWorthHistory: [this.startingCash]
      }
    }));

    // Initialize properties state
    this.properties = {};
    BoardSquares.forEach(sq => {
      if (sq.type === TileTypes.PROPERTY || sq.type === TileTypes.RAILROAD || sq.type === TileTypes.UTILITY) {
        this.properties[sq.index] = {
          index: sq.index,
          owner: null,
          houses: 0,
          hotel: false,
          mortgaged: false
        };
      }
    });

    // Decks
    this.chanceDeck = this.shuffle([...ChanceCards]);
    this.communityChestDeck = this.shuffle([...CommunityChestCards]);
  }

  // Subscribe to game events for UI/3D updates
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(h => h !== handler));
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in event listener ${event}:`, err);
        }
      });
    }
  }

  log(msg, type = 'info') {
    const entry = { turn: this.turnCount, player: this.getActivePlayer().name, text: msg, type, timestamp: Date.now() };
    this.history.push(entry);
    this.emit('log', entry);
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Deep clone for game tree (Minimax) lookahead without copying event listeners
  clone() {
    const copy = new GameState({
      winTarget: this.winTarget,
      startingCash: this.startingCash,
      salary: this.salary
    });

    copy.turn = this.turn;
    copy.phase = this.phase;
    copy.dice = [...this.dice];
    copy.doublesCount = this.doublesCount;
    copy.lastLandedTile = this.lastLandedTile;
    copy.turnCount = this.turnCount;
    copy.winner = this.winner;

    copy.players = this.players.map(p => ({
      ...p,
      stats: {
        ...p.stats,
        netWorthHistory: [...p.stats.netWorthHistory]
      }
    }));

    copy.properties = {};
    for (const key in this.properties) {
      copy.properties[key] = { ...this.properties[key] };
    }

    copy.chanceDeck = [...this.chanceDeck];
    copy.communityChestDeck = [...this.communityChestDeck];

    return copy;
  }

  getActivePlayer() {
    return this.players[this.turn];
  }

  getAlivePlayers() {
    return this.players.filter(p => !p.bankrupt);
  }

  // Calculate true Net Worth (Cash + Unmortgaged/Mortgaged Properties + House values)
  getPlayerNetWorth(playerId) {
    const player = this.players[playerId];
    if (player.bankrupt) return 0;

    let netWorth = player.money;
    for (const idx in this.properties) {
      const prop = this.properties[idx];
      if (prop.owner === playerId) {
        const sq = BoardSquares[prop.index];
        if (prop.mortgaged) {
          netWorth += sq.mortgage;
        } else {
          netWorth += sq.price;
          if (prop.houses > 0) {
            netWorth += prop.houses * (sq.housePrice / 2); // Liquidation value
          }
        }
      }
    }
    return netWorth;
  }

  // Roll dice for active player
  rollDice(customDice = null) {
    const player = this.getActivePlayer();
    if (player.bankrupt || this.winner !== null) return null;

    const d1 = customDice ? customDice[0] : Math.floor(Math.random() * 6) + 1;
    const d2 = customDice ? customDice[1] : Math.floor(Math.random() * 6) + 1;
    this.dice = [d1, d2];
    const isDouble = d1 === d2;

    this.log(`${player.name} rolled [${d1}, ${d2}] (Total: ${d1 + d2})${isDouble ? ' - Doubles!' : ''}`, 'roll');

    if (player.inJail) {
      if (isDouble) {
        this.log(`${player.name} rolled doubles and is released from Jail!`, 'success');
        player.inJail = false;
        player.jailTurns = 0;
        this.doublesCount = 0;
        this.movePlayer(player.id, d1 + d2);
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          this.log(`${player.name} served 3 turns in jail and pays $50 fine to get out.`, 'info');
          this.payMoney(player.id, 50);
          player.inJail = false;
          player.jailTurns = 0;
          this.movePlayer(player.id, d1 + d2);
        } else {
          this.log(`${player.name} stays in jail (Turn ${player.jailTurns}/3).`, 'warning');
          this.phase = 'action';
          this.emit('diceRolled', { dice: this.dice, player });
          return { dice: this.dice, isDouble, inJail: true };
        }
      }
    } else {
      if (isDouble) {
        this.doublesCount++;
        if (this.doublesCount >= 3) {
          this.log(`${player.name} rolled 3 doubles in a row and was sent to Jail for speeding!`, 'danger');
          this.sendToJail(player.id);
          this.phase = 'action';
          this.emit('diceRolled', { dice: this.dice, player });
          return { dice: this.dice, isDouble, sentToJail: true };
        }
      } else {
        this.doublesCount = 0;
      }

      this.movePlayer(player.id, d1 + d2);
    }

    this.emit('diceRolled', { dice: this.dice, player });
    return { dice: this.dice, isDouble };
  }

  // Move player forward, handling passing GO ($200 salary)
  movePlayer(playerId, steps, options = { collectGo: true }) {
    const player = this.players[playerId];
    const oldPos = player.position;
    let newPos = (oldPos + steps) % 40;
    if (newPos < 0) newPos += 40;

    // Passed GO?
    if (options.collectGo && steps > 0 && newPos < oldPos) {
      player.money += this.salary;
      this.log(`${player.name} passed GO and collected $${this.salary}!`, 'success');
      this.emit('passedGo', { player, salary: this.salary });
    }

    player.position = newPos;
    this.lastLandedTile = newPos;
    this.emit('playerMoved', { player, oldPos, newPos, steps });

    // Handle the tile landed on
    return this.handleLand(player.id, newPos);
  }

  // Handle landing on a specific square
  handleLand(playerId, tileIndex) {
    const player = this.players[playerId];
    const sq = BoardSquares[tileIndex];
    this.phase = 'action';

    this.log(`${player.name} landed on ${sq.name}`, 'land');

    let landResult = { tile: sq, actionRequired: null };

    switch (sq.type) {
      case TileTypes.GO:
        // Already collected if passed or landed
        break;

      case TileTypes.PROPERTY:
      case TileTypes.RAILROAD:
      case TileTypes.UTILITY: {
        const prop = this.properties[tileIndex];
        if (prop.owner === null) {
          // Unowned property - can buy
          landResult.actionRequired = 'buy_decision';
          this.emit('promptBuy', { player, property: sq });
        } else if (prop.owner === playerId) {
          // Owned by self
          this.log(`${player.name} owns this property.`, 'info');
        } else if (!prop.mortgaged) {
          // Owned by opponent and not mortgaged -> Pay Rent!
          const owner = this.players[prop.owner];
          const rentAmount = this.calculateRent(tileIndex);
          this.log(`${player.name} must pay $${rentAmount} rent to ${owner.name}.`, 'warning');
          this.payRent(playerId, owner.id, rentAmount);
          landResult.rentPaid = rentAmount;
        } else {
          this.log(`${sq.name} is mortgaged; no rent owed.`, 'info');
        }
        break;
      }

      case TileTypes.TAX: {
        const tax = sq.taxAmount || 100;
        this.log(`${player.name} pays $${tax} tax.`, 'warning');
        this.payMoney(playerId, tax);
        break;
      }

      case TileTypes.GO_TO_JAIL: {
        this.log(`${player.name} landed on Go To Jail!`, 'danger');
        this.sendToJail(playerId);
        break;
      }

      case TileTypes.CHANCE: {
        landResult.card = this.drawChanceCard(playerId);
        break;
      }

      case TileTypes.COMMUNITY_CHEST: {
        landResult.card = this.drawCommunityChestCard(playerId);
        break;
      }

      case TileTypes.JAIL:
      case TileTypes.FREE_PARKING:
        // Neutral safe squares
        break;
    }

    this.checkWinCondition();
    this.emit('landed', { player, tile: sq, landResult });
    return landResult;
  }

  // Calculate authentic rent for any property index
  calculateRent(tileIndex) {
    const sq = BoardSquares[tileIndex];
    const prop = this.properties[tileIndex];
    if (!prop || prop.owner === null || prop.mortgaged) return 0;

    const ownerId = prop.owner;

    if (sq.type === TileTypes.PROPERTY) {
      if (prop.hotel) return sq.rent[5];
      if (prop.houses > 0) return sq.rent[prop.houses];

      // Base rent: if owner owns all properties in this color group, base rent doubles!
      if (this.ownsEntireGroup(ownerId, sq.group)) {
        return sq.baseRent * 2;
      }
      return sq.baseRent;
    } else if (sq.type === TileTypes.RAILROAD) {
      // 1 RR: 25, 2 RR: 50, 3 RR: 100, 4 RR: 200
      const count = this.getGroupOwnedCount(ownerId, 'railroad');
      return sq.rent[Math.min(count - 1, 3)] || 25;
    } else if (sq.type === TileTypes.UTILITY) {
      // 1 Utility: 4x dice roll; 2 Utilities: 10x dice roll
      const count = this.getGroupOwnedCount(ownerId, 'utility');
      const diceSum = this.dice[0] + this.dice[1] || 7;
      return count >= 2 ? diceSum * 10 : diceSum * 4;
    }

    return 0;
  }

  ownsEntireGroup(playerId, groupId) {
    const group = ColorGroups[groupId.toUpperCase()];
    if (!group) return false;
    return group.memberIndices.every(idx => this.properties[idx].owner === playerId);
  }

  getGroupOwnedCount(playerId, groupId) {
    const group = ColorGroups[groupId.toUpperCase()];
    if (!group) return 0;
    return group.memberIndices.filter(idx => this.properties[idx].owner === playerId).length;
  }

  // Player buys unowned property
  buyProperty(playerId, tileIndex) {
    const player = this.players[playerId];
    const prop = this.properties[tileIndex];
    const sq = BoardSquares[tileIndex];

    if (!prop || prop.owner !== null || player.money < sq.price) {
      return false;
    }

    player.money -= sq.price;
    prop.owner = playerId;
    player.stats.propertiesBought++;

    this.log(`${player.name} bought ${sq.name} for $${sq.price}!`, 'success');
    this.emit('propertyBought', { player, property: sq, propState: prop });
    this.checkWinCondition();
    return true;
  }

  // Pay rent between players
  payRent(tenantId, ownerId, amount) {
    const tenant = this.players[tenantId];
    const owner = this.players[ownerId];

    if (tenant.money < amount) {
      // Attempt auto-liquidation before declaring bankruptcy
      this.attemptAutoLiquidation(tenantId, amount);
    }

    if (tenant.money < amount) {
      // Bankruptcy to owner
      const paid = Math.max(0, tenant.money);
      owner.money += paid;
      owner.stats.rentCollected += paid;
      tenant.money = 0;
      this.declareBankruptcy(tenantId, ownerId);
    } else {
      tenant.money -= amount;
      owner.money += amount;
      tenant.stats.rentPaid += amount;
      owner.stats.rentCollected += amount;
      this.emit('rentPaid', { tenant, owner, amount });
    }
    this.checkWinCondition();
  }

  // Deduct money for taxes/fees
  payMoney(playerId, amount) {
    const player = this.players[playerId];
    if (player.money < amount) {
      this.attemptAutoLiquidation(playerId, amount);
    }
    if (player.money < amount) {
      this.declareBankruptcy(playerId, null);
    } else {
      player.money -= amount;
      this.emit('moneyChanged', { player, amount: -amount });
    }
    this.checkWinCondition();
  }

  // Auto-liquidate assets if cash is short:
  // 1. Mortgages unmonopolized properties
  // 2. Sells houses across developed properties
  attemptAutoLiquidation(playerId, targetCashNeeded) {
    const player = this.players[playerId];

    // First: Mortgage single unmonopolized properties
    for (const idx in this.properties) {
      if (player.money >= targetCashNeeded) break;
      const prop = this.properties[idx];
      const sq = BoardSquares[prop.index];
      if (prop.owner === playerId && !prop.mortgaged && prop.houses === 0) {
        if (!this.ownsEntireGroup(playerId, sq.group)) {
          this.mortgageProperty(playerId, prop.index);
        }
      }
    }

    // Second: Sell houses from least profitable monopolies
    for (const idx in this.properties) {
      if (player.money >= targetCashNeeded) break;
      const prop = this.properties[idx];
      if (prop.owner === playerId && prop.houses > 0) {
        this.sellHouse(playerId, prop.index);
      }
    }

    // Third: Mortgage remaining monopolized properties if still short
    for (const idx in this.properties) {
      if (player.money >= targetCashNeeded) break;
      const prop = this.properties[idx];
      if (prop.owner === playerId && !prop.mortgaged && prop.houses === 0) {
        this.mortgageProperty(playerId, prop.index);
      }
    }
  }

  // Build house on a property (rules: must own entire group, build evenly)
  buildHouse(playerId, tileIndex) {
    const player = this.players[playerId];
    const prop = this.properties[tileIndex];
    const sq = BoardSquares[tileIndex];

    if (!prop || prop.owner !== playerId || prop.mortgaged) return false;
    if (!this.ownsEntireGroup(playerId, sq.group)) return false;
    if (prop.hotel || prop.houses >= 5) return false;
    if (player.money < sq.housePrice) return false;

    // Check even building rule
    const group = ColorGroups[sq.group.toUpperCase()];
    const minHouses = Math.min(...group.memberIndices.map(i => this.properties[i].houses));
    if (prop.houses > minHouses) return false; // Must build evenly

    player.money -= sq.housePrice;
    prop.houses++;
    if (prop.houses === 5) {
      prop.hotel = true;
    }

    this.log(`${player.name} built a ${prop.hotel ? 'HOTEL' : 'house'} on ${sq.name}! (Now ${prop.houses} units)`, 'success');
    this.emit('houseBuilt', { player, property: sq, propState: prop });
    return true;
  }

  // Sell house on a property
  sellHouse(playerId, tileIndex) {
    const player = this.players[playerId];
    const prop = this.properties[tileIndex];
    const sq = BoardSquares[tileIndex];

    if (!prop || prop.owner !== playerId || prop.houses <= 0) return false;

    // Even selling rule
    const group = ColorGroups[sq.group.toUpperCase()];
    const maxHouses = Math.max(...group.memberIndices.map(i => this.properties[i].houses));
    if (prop.houses < maxHouses) return false;

    const refund = Math.floor(sq.housePrice / 2);
    player.money += refund;
    prop.houses--;
    prop.hotel = false;

    this.log(`${player.name} sold a house on ${sq.name} for $${refund}.`, 'info');
    this.emit('houseSold', { player, property: sq, propState: prop });
    return true;
  }

  // Mortgage property
  mortgageProperty(playerId, tileIndex) {
    const player = this.players[playerId];
    const prop = this.properties[tileIndex];
    const sq = BoardSquares[tileIndex];

    if (!prop || prop.owner !== playerId || prop.mortgaged || prop.houses > 0) return false;

    prop.mortgaged = true;
    player.money += sq.mortgage;
    this.log(`${player.name} mortgaged ${sq.name} and received $${sq.mortgage}.`, 'warning');
    this.emit('propertyMortgaged', { player, property: sq });
    return true;
  }

  // Unmortgage property (pay mortgage + 10% interest)
  unmortgageProperty(playerId, tileIndex) {
    const player = this.players[playerId];
    const prop = this.properties[tileIndex];
    const sq = BoardSquares[tileIndex];

    if (!prop || prop.owner !== playerId || !prop.mortgaged) return false;

    const cost = Math.floor(sq.mortgage * 1.1);
    if (player.money < cost) return false;

    player.money -= cost;
    prop.mortgaged = false;
    this.log(`${player.name} unmortgaged ${sq.name} for $${cost}.`, 'success');
    this.emit('propertyUnmortgaged', { player, property: sq });
    return true;
  }

  // Propose & execute trade between two players
  executeTrade(trade) {
    const { fromId, toId, offerMoney = 0, offerPropIndices = [], requestMoney = 0, requestPropIndices = [] } = trade;
    const fromP = this.players[fromId];
    const toP = this.players[toId];

    if (fromP.money < offerMoney || toP.money < requestMoney) return false;

    // Verify ownership
    for (const idx of offerPropIndices) {
      if (this.properties[idx].owner !== fromId) return false;
    }
    for (const idx of requestPropIndices) {
      if (this.properties[idx].owner !== toId) return false;
    }

    // Exchange money
    fromP.money -= offerMoney;
    toP.money += offerMoney;
    toP.money -= requestMoney;
    fromP.money += requestMoney;

    // Exchange properties
    offerPropIndices.forEach(idx => {
      this.properties[idx].owner = toId;
    });
    requestPropIndices.forEach(idx => {
      this.properties[idx].owner = fromId;
    });

    this.log(`Trade executed between ${fromP.name} and ${toP.name}!`, 'success');
    this.emit('tradeExecuted', trade);
    this.checkWinCondition();
    return true;
  }

  // Send player to Jail
  sendToJail(playerId) {
    const player = this.players[playerId];
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.doublesCount = 0;
    this.log(`${player.name} was sent directly to Jail!`, 'danger');
    this.emit('sentToJail', { player });
  }

  // Leave jail via $50 fine, card, or doubles
  releaseFromJail(playerId, method = 'pay') {
    const player = this.players[playerId];
    if (!player.inJail) return;

    if (method === 'card' && player.getOutOfJailCards > 0) {
      player.getOutOfJailCards--;
      player.inJail = false;
      player.jailTurns = 0;
      this.log(`${player.name} used a Get Out of Jail Free card!`, 'success');
    } else if (method === 'pay' && player.money >= 50) {
      player.money -= 50;
      player.inJail = false;
      player.jailTurns = 0;
      this.log(`${player.name} paid $50 fine to get out of Jail.`, 'info');
    }
    this.emit('releasedFromJail', { player, method });
  }

  // Draw Chance card
  drawChanceCard(playerId) {
    const card = this.chanceDeck.shift();
    this.chanceDeck.push(card);
    const player = this.players[playerId];
    this.log(`Chance Card: "${card.text}"`, 'info');
    this.executeCardAction(playerId, card);
    return card;
  }

  // Draw Community Chest card
  drawCommunityChestCard(playerId) {
    const card = this.communityChestDeck.shift();
    this.communityChestDeck.push(card);
    const player = this.players[playerId];
    this.log(`Community Chest: "${card.text}"`, 'info');
    this.executeCardAction(playerId, card);
    return card;
  }

  // Execute card logic
  executeCardAction(playerId, card) {
    const player = this.players[playerId];
    switch (card.action) {
      case 'advance': {
        const steps = (card.target - player.position + 40) % 40;
        this.movePlayer(playerId, steps, { collectGo: true });
        break;
      }
      case 'money': {
        if (card.amount > 0) {
          player.money += card.amount;
        } else {
          this.payMoney(playerId, Math.abs(card.amount));
        }
        break;
      }
      case 'jail': {
        this.sendToJail(playerId);
        break;
      }
      case 'jail_free': {
        player.getOutOfJailCards++;
        break;
      }
      case 'back_steps': {
        this.movePlayer(playerId, -card.steps, { collectGo: false });
        break;
      }
      case 'pay_players': {
        this.getAlivePlayers().forEach(p => {
          if (p.id !== playerId) {
            this.payRent(playerId, p.id, card.amount);
          }
        });
        break;
      }
      case 'collect_players': {
        this.getAlivePlayers().forEach(p => {
          if (p.id !== playerId) {
            this.payRent(p.id, playerId, card.amount);
          }
        });
        break;
      }
      case 'repairs': {
        let totalHouses = 0;
        let totalHotels = 0;
        for (const idx in this.properties) {
          const prop = this.properties[idx];
          if (prop.owner === playerId) {
            if (prop.hotel) totalHotels++;
            else totalHouses += prop.houses;
          }
        }
        const cost = totalHouses * card.house + totalHotels * card.hotel;
        if (cost > 0) {
          this.log(`${player.name} pays $${cost} for repairs (${totalHouses} houses, ${totalHotels} hotels).`, 'warning');
          this.payMoney(playerId, cost);
        }
        break;
      }
      case 'nearest_railroad': {
        const rr = [5, 15, 25, 35];
        let target = rr.find(r => r > player.position) || rr[0];
        const steps = (target - player.position + 40) % 40;
        this.movePlayer(playerId, steps, { collectGo: true });
        break;
      }
      case 'nearest_utility': {
        const ut = [12, 28];
        let target = ut.find(u => u > player.position) || ut[0];
        const steps = (target - player.position + 40) % 40;
        this.movePlayer(playerId, steps, { collectGo: true });
        break;
      }
    }
  }

  // Declare player bankrupt
  declareBankruptcy(playerId, creditorId = null) {
    const player = this.players[playerId];
    player.bankrupt = true;
    player.money = 0;

    this.log(`💥 ${player.name} went BANKRUPT!`, 'danger');

    // Transfer or auction properties
    for (const idx in this.properties) {
      const prop = this.properties[idx];
      if (prop.owner === playerId) {
        if (creditorId !== null) {
          prop.owner = creditorId; // Transferred to creditor
          this.log(`${BoardSquares[idx].name} transferred to ${this.players[creditorId].name}.`, 'info');
        } else {
          // Bank gets properties back unmortgaged
          prop.owner = null;
          prop.mortgaged = false;
          prop.houses = 0;
          prop.hotel = false;
        }
      }
    }

    this.emit('bankruptcy', { player, creditor: creditorId !== null ? this.players[creditorId] : null });
    this.checkWinCondition();
  }

  // Check if someone has won by target money or bankruptcy
  checkWinCondition() {
    if (this.winner !== null) return this.winner;

    // 1. Target Balance Check
    if (this.winTarget > 0) {
      for (const p of this.getAlivePlayers()) {
        if (p.money >= this.winTarget) {
          this.winner = p;
          this.phase = 'game_over';
          this.log(`🏆 ${p.name} reached target balance $${this.winTarget} and WON THE GAME!`, 'success');
          this.emit('gameOver', { winner: p, reason: 'target_balance' });
          return p;
        }
      }
    }

    // 2. Last Standing Player Check
    const alive = this.getAlivePlayers();
    if (alive.length === 1) {
      this.winner = alive[0];
      this.phase = 'game_over';
      this.log(`🏆 ${alive[0].name} is the last player standing and WON THE GAME!`, 'success');
      this.emit('gameOver', { winner: alive[0], reason: 'bankruptcy' });
      return alive[0];
    } else if (alive.length === 0) {
      this.phase = 'game_over';
      return null;
    }

    return null;
  }

  // End turn and advance to next player
  endTurn() {
    if (this.winner !== null) return;

    const currentP = this.getActivePlayer();
    currentP.stats.turnsPlayed++;
    currentP.stats.netWorthHistory.push(this.getPlayerNetWorth(currentP.id));

    // Next alive player
    let nextTurn = (this.turn + 1) % this.players.length;
    let loopCount = 0;
    while (this.players[nextTurn].bankrupt && loopCount < this.players.length) {
      nextTurn = (nextTurn + 1) % this.players.length;
      loopCount++;
    }

    this.turn = nextTurn;
    this.phase = 'roll';
    this.doublesCount = 0;
    this.turnCount++;

    const nextP = this.getActivePlayer();
    this.emit('turnChanged', { player: nextP, turnCount: this.turnCount });
    this.checkWinCondition();
  }
}
