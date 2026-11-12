// Official Monopoly 40-Square Board Data & Card Decks
export const ColorGroups = {
  BROWN: { id: 'brown', name: 'Brown', color: '#8B4513', housePrice: 50, memberIndices: [1, 3] },
  LIGHT_BLUE: { id: 'light_blue', name: 'Light Blue', color: '#87CEEB', housePrice: 50, memberIndices: [6, 8, 9] },
  PINK: { id: 'pink', name: 'Pink', color: '#FF1493', housePrice: 100, memberIndices: [11, 13, 14] },
  ORANGE: { id: 'orange', name: 'Orange', color: '#FF8C00', housePrice: 100, memberIndices: [16, 18, 19] },
  RED: { id: 'red', name: 'Red', color: '#E53935', housePrice: 150, memberIndices: [21, 23, 24] },
  YELLOW: { id: 'yellow', name: 'Yellow', color: '#FFD700', housePrice: 150, memberIndices: [26, 27, 29] },
  GREEN: { id: 'green', name: 'Green', color: '#2E7D32', housePrice: 200, memberIndices: [31, 32, 34] },
  DARK_BLUE: { id: 'dark_blue', name: 'Dark Blue', color: '#1E3A8A', housePrice: 200, memberIndices: [37, 39] },
  RAILROAD: { id: 'railroad', name: 'Railroad', color: '#4B5563', housePrice: 0, memberIndices: [5, 15, 25, 35] },
  UTILITY: { id: 'utility', name: 'Utility', color: '#6B7280', housePrice: 0, memberIndices: [12, 28] }
};

export const TileTypes = {
  GO: 'go',
  PROPERTY: 'property',
  RAILROAD: 'railroad',
  UTILITY: 'utility',
  COMMUNITY_CHEST: 'community_chest',
  CHANCE: 'chance',
  TAX: 'tax',
  JAIL: 'jail',
  FREE_PARKING: 'free_parking',
  GO_TO_JAIL: 'go_to_jail'
};

// 40 Tiles in standard clockwise order from index 0 (GO) to 39 (Boardwalk)
export const BoardSquares = [
  {
    index: 0,
    name: 'GO',
    type: TileTypes.GO,
    description: 'Collect $200 salary as you pass.',
    icon: 'flag'
  },
  {
    index: 1,
    name: 'Mediterranean Avenue',
    type: TileTypes.PROPERTY,
    group: 'brown',
    price: 60,
    mortgage: 30,
    housePrice: 50,
    baseRent: 2,
    rent: [2, 10, 30, 90, 160, 250] // [base, 1h, 2h, 3h, 4h, hotel]
  },
  {
    index: 2,
    name: 'Community Chest',
    type: TileTypes.COMMUNITY_CHEST,
    description: 'Draw a Community Chest card',
    icon: 'chest'
  },
  {
    index: 3,
    name: 'Baltic Avenue',
    type: TileTypes.PROPERTY,
    group: 'brown',
    price: 60,
    mortgage: 30,
    housePrice: 50,
    baseRent: 4,
    rent: [4, 20, 60, 180, 320, 450]
  },
  {
    index: 4,
    name: 'Income Tax',
    type: TileTypes.TAX,
    taxAmount: 200,
    description: 'Pay $200'
  },
  {
    index: 5,
    name: 'Reading Railroad',
    type: TileTypes.RAILROAD,
    group: 'railroad',
    price: 200,
    mortgage: 100,
    baseRent: 25,
    rent: [25, 50, 100, 200] // 1, 2, 3, 4 railroads owned
  },
  {
    index: 6,
    name: 'Oriental Avenue',
    type: TileTypes.PROPERTY,
    group: 'light_blue',
    price: 100,
    mortgage: 50,
    housePrice: 50,
    baseRent: 6,
    rent: [6, 30, 90, 270, 400, 550]
  },
  {
    index: 7,
    name: 'Chance',
    type: TileTypes.CHANCE,
    description: 'Draw a Chance card',
    icon: 'question'
  },
  {
    index: 8,
    name: 'Vermont Avenue',
    type: TileTypes.PROPERTY,
    group: 'light_blue',
    price: 100,
    mortgage: 50,
    housePrice: 50,
    baseRent: 6,
    rent: [6, 30, 90, 270, 400, 550]
  },
  {
    index: 9,
    name: 'Connecticut Avenue',
    type: TileTypes.PROPERTY,
    group: 'light_blue',
    price: 120,
    mortgage: 60,
    housePrice: 50,
    baseRent: 8,
    rent: [8, 40, 100, 300, 450, 600]
  },
  {
    index: 10,
    name: 'Jail / Just Visiting',
    type: TileTypes.JAIL,
    description: 'In Jail or Just Visiting'
  },
  {
    index: 11,
    name: 'St. Charles Place',
    type: TileTypes.PROPERTY,
    group: 'pink',
    price: 140,
    mortgage: 70,
    housePrice: 100,
    baseRent: 10,
    rent: [10, 50, 150, 450, 625, 750]
  },
  {
    index: 12,
    name: 'Electric Company',
    type: TileTypes.UTILITY,
    group: 'utility',
    price: 150,
    mortgage: 75,
    description: 'Rent is 4x or 10x dice roll'
  },
  {
    index: 13,
    name: 'States Avenue',
    type: TileTypes.PROPERTY,
    group: 'pink',
    price: 140,
    mortgage: 70,
    housePrice: 100,
    baseRent: 10,
    rent: [10, 50, 150, 450, 625, 750]
  },
  {
    index: 14,
    name: 'Virginia Avenue',
    type: TileTypes.PROPERTY,
    group: 'pink',
    price: 160,
    mortgage: 80,
    housePrice: 100,
    baseRent: 12,
    rent: [12, 60, 180, 500, 700, 900]
  },
  {
    index: 15,
    name: 'Pennsylvania Railroad',
    type: TileTypes.RAILROAD,
    group: 'railroad',
    price: 200,
    mortgage: 100,
    baseRent: 25,
    rent: [25, 50, 100, 200]
  },
  {
    index: 16,
    name: 'St. James Place',
    type: TileTypes.PROPERTY,
    group: 'orange',
    price: 180,
    mortgage: 90,
    housePrice: 100,
    baseRent: 14,
    rent: [14, 70, 200, 550, 750, 950]
  },
  {
    index: 17,
    name: 'Community Chest',
    type: TileTypes.COMMUNITY_CHEST,
    description: 'Draw a Community Chest card'
  },
  {
    index: 18,
    name: 'Tennessee Avenue',
    type: TileTypes.PROPERTY,
    group: 'orange',
    price: 180,
    mortgage: 90,
    housePrice: 100,
    baseRent: 14,
    rent: [14, 70, 200, 550, 750, 950]
  },
  {
    index: 19,
    name: 'New York Avenue',
    type: TileTypes.PROPERTY,
    group: 'orange',
    price: 200,
    mortgage: 100,
    housePrice: 100,
    baseRent: 16,
    rent: [16, 80, 220, 600, 800, 1000]
  },
  {
    index: 20,
    name: 'Free Parking',
    type: TileTypes.FREE_PARKING,
    description: 'Rest area, no rent'
  },
  {
    index: 21,
    name: 'Kentucky Avenue',
    type: TileTypes.PROPERTY,
    group: 'red',
    price: 220,
    mortgage: 110,
    housePrice: 150,
    baseRent: 18,
    rent: [18, 90, 250, 700, 875, 1050]
  },
  {
    index: 22,
    name: 'Chance',
    type: TileTypes.CHANCE,
    description: 'Draw a Chance card'
  },
  {
    index: 23,
    name: 'Indiana Avenue',
    type: TileTypes.PROPERTY,
    group: 'red',
    price: 220,
    mortgage: 110,
    housePrice: 150,
    baseRent: 18,
    rent: [18, 90, 250, 700, 875, 1050]
  },
  {
    index: 24,
    name: 'Illinois Avenue',
    type: TileTypes.PROPERTY,
    group: 'red',
    price: 240,
    mortgage: 120,
    housePrice: 150,
    baseRent: 20,
    rent: [20, 100, 300, 750, 925, 1100]
  },
  {
    index: 25,
    name: 'B&O Railroad',
    type: TileTypes.RAILROAD,
    group: 'railroad',
    price: 200,
    mortgage: 100,
    baseRent: 25,
    rent: [25, 50, 100, 200]
  },
  {
    index: 26,
    name: 'Atlantic Avenue',
    type: TileTypes.PROPERTY,
    group: 'yellow',
    price: 260,
    mortgage: 130,
    housePrice: 150,
    baseRent: 22,
    rent: [22, 110, 330, 800, 975, 1150]
  },
  {
    index: 27,
    name: 'Ventnor Avenue',
    type: TileTypes.PROPERTY,
    group: 'yellow',
    price: 260,
    mortgage: 130,
    housePrice: 150,
    baseRent: 22,
    rent: [22, 110, 330, 800, 975, 1150]
  },
  {
    index: 28,
    name: 'Water Works',
    type: TileTypes.UTILITY,
    group: 'utility',
    price: 150,
    mortgage: 75,
    description: 'Rent is 4x or 10x dice roll'
  },
  {
    index: 29,
    name: 'Marvin Gardens',
    type: TileTypes.PROPERTY,
    group: 'yellow',
    price: 280,
    mortgage: 140,
    housePrice: 150,
    baseRent: 24,
    rent: [24, 120, 360, 850, 1025, 1200]
  },
  {
    index: 30,
    name: 'Go to Jail',
    type: TileTypes.GO_TO_JAIL,
    description: 'Go directly to Jail. Do not pass GO.'
  },
  {
    index: 31,
    name: 'Pacific Avenue',
    type: TileTypes.PROPERTY,
    group: 'green',
    price: 300,
    mortgage: 150,
    housePrice: 200,
    baseRent: 26,
    rent: [26, 130, 390, 900, 1100, 1275]
  },
  {
    index: 32,
    name: 'North Carolina Avenue',
    type: TileTypes.PROPERTY,
    group: 'green',
    price: 300,
    mortgage: 150,
    housePrice: 200,
    baseRent: 26,
    rent: [26, 130, 390, 900, 1100, 1275]
  },
  {
    index: 33,
    name: 'Community Chest',
    type: TileTypes.COMMUNITY_CHEST,
    description: 'Draw a Community Chest card'
  },
  {
    index: 34,
    name: 'Pennsylvania Avenue',
    type: TileTypes.PROPERTY,
    group: 'green',
    price: 320,
    mortgage: 160,
    housePrice: 200,
    baseRent: 28,
    rent: [28, 150, 450, 1000, 1200, 1400]
  },
  {
    index: 35,
    name: 'Short Line Railroad',
    type: TileTypes.RAILROAD,
    group: 'railroad',
    price: 200,
    mortgage: 100,
    baseRent: 25,
    rent: [25, 50, 100, 200]
  },
  {
    index: 36,
    name: 'Chance',
    type: TileTypes.CHANCE,
    description: 'Draw a Chance card'
  },
  {
    index: 37,
    name: 'Park Place',
    type: TileTypes.PROPERTY,
    group: 'dark_blue',
    price: 350,
    mortgage: 175,
    housePrice: 200,
    baseRent: 35,
    rent: [35, 175, 500, 1100, 1300, 1500]
  },
  {
    index: 38,
    name: 'Luxury Tax',
    type: TileTypes.TAX,
    taxAmount: 100,
    description: 'Pay $100'
  },
  {
    index: 39,
    name: 'Boardwalk',
    type: TileTypes.PROPERTY,
    group: 'dark_blue',
    price: 400,
    mortgage: 200,
    housePrice: 200,
    baseRent: 50,
    rent: [50, 200, 600, 1400, 1700, 2000]
  }
];

// Chance Cards Definition
export const ChanceCards = [
  { id: 'ch_go', text: 'Advance to GO. Collect $200.', action: 'advance', target: 0 },
  { id: 'ch_boardwalk', text: 'Advance to Boardwalk.', action: 'advance', target: 39 },
  { id: 'ch_illinois', text: 'Advance to Illinois Ave. If you pass GO, collect $200.', action: 'advance', target: 24 },
  { id: 'ch_st_charles', text: 'Advance to St. Charles Place. If you pass GO, collect $200.', action: 'advance', target: 11 },
  { id: 'ch_railroad', text: 'Advance to the nearest Railroad and pay owner twice normal rent.', action: 'nearest_railroad' },
  { id: 'ch_utility', text: 'Advance to nearest Utility and pay 10x dice roll.', action: 'nearest_utility' },
  { id: 'ch_dividend', text: 'Bank pays you dividend of $50.', action: 'money', amount: 50 },
  { id: 'ch_jail_free', text: 'Get Out of Jail Free card. Keep or trade.', action: 'jail_free' },
  { id: 'ch_back_3', text: 'Go back 3 spaces.', action: 'back_steps', steps: 3 },
  { id: 'ch_jail', text: 'Go directly to Jail. Do not pass GO. Do not collect $200.', action: 'jail' },
  { id: 'ch_repairs', text: 'General repairs: Pay $25 per house, $100 per hotel.', action: 'repairs', house: 25, hotel: 100 },
  { id: 'ch_poor_tax', text: 'Pay poor tax of $15.', action: 'money', amount: -15 },
  { id: 'ch_reading', text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', action: 'advance', target: 5 },
  { id: 'ch_chairman', text: 'Elected Chairman of the Board. Pay each player $50.', action: 'pay_players', amount: 50 },
  { id: 'ch_building_loan', text: 'Building loan matures. Collect $150.', action: 'money', amount: 150 }
];

// Community Chest Cards Definition
export const CommunityChestCards = [
  { id: 'cc_go', text: 'Advance to GO. Collect $200.', action: 'advance', target: 0 },
  { id: 'cc_bank_error', text: 'Bank error in your favor. Collect $200.', action: 'money', amount: 200 },
  { id: 'cc_doctor', text: 'Doctor fee. Pay $50.', action: 'money', amount: -50 },
  { id: 'cc_sale_stock', text: 'From sale of stock you get $50.', action: 'money', amount: 50 },
  { id: 'cc_jail_free', text: 'Get Out of Jail Free card. Keep or trade.', action: 'jail_free' },
  { id: 'cc_jail', text: 'Go to Jail. Go directly to Jail. Do not pass GO.', action: 'jail' },
  { id: 'cc_holiday', text: 'Holiday fund matures. Receive $100.', action: 'money', amount: 100 },
  { id: 'cc_tax_refund', text: 'Income tax refund. Collect $20.', action: 'money', amount: 20 },
  { id: 'cc_birthday', text: 'It is your birthday. Collect $10 from every player.', action: 'collect_players', amount: 10 },
  { id: 'cc_life_insurance', text: 'Life insurance matures. Collect $100.', action: 'money', amount: 100 },
  { id: 'cc_hospital', text: 'Pay hospital fees of $100.', action: 'money', amount: -100 },
  { id: 'cc_school', text: 'Pay school fees of $50.', action: 'money', amount: -50 },
  { id: 'cc_consultancy', text: 'Receive $25 consultancy fee.', action: 'money', amount: 25 },
  { id: 'cc_street_repairs', text: 'Street repairs: Pay $40 per house, $115 per hotel.', action: 'repairs', house: 40, hotel: 115 },
  { id: 'cc_beauty', text: 'Won second prize in a beauty contest. Collect $10.', action: 'money', amount: 10 },
  { id: 'cc_inherit', text: 'You inherit $100.', action: 'money', amount: 100 }
];

// Probability distribution of 2 standard 6-sided dice (sum 2 to 12)
export const DiceProbabilities = {
  2: 1 / 36,
  3: 2 / 36,
  4: 3 / 36,
  5: 4 / 36,
  6: 5 / 36,
  7: 6 / 36,
  8: 5 / 36,
  9: 4 / 36,
  10: 3 / 36,
  11: 2 / 36,
  12: 1 / 36
};

// Helper: converts tileIndex (0-39) to board coordinates for standard 11x11 square grid
// Row 0 = Top, Row 10 = Bottom; Col 0 = Left, Col 10 = Right
export function getTileGridCoords(tileIndex) {
  if (tileIndex >= 0 && tileIndex <= 10) {
    // Bottom row: 0 (bottom-right: row 10, col 10) to 10 (bottom-left: row 10, col 0)
    return { row: 10, col: 10 - tileIndex, side: 'bottom' };
  } else if (tileIndex <= 20) {
    // Left column: 10 (row 10, col 0) to 20 (top-left: row 0, col 0)
    return { row: 20 - tileIndex, col: 0, side: 'left' };
  } else if (tileIndex <= 30) {
    // Top row: 20 (top-left: row 0, col 0) to 30 (top-right: row 0, col 10)
    return { row: 0, col: tileIndex - 20, side: 'top' };
  } else {
    // Right column: 30 (top-right: row 0, col 10) to 39 (row 9, col 10)
    return { row: tileIndex - 30, col: 10, side: 'right' };
  }
}
