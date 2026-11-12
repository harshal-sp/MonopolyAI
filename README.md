# 🎲 Monopoly AI — Expectiminimax Engine & 3D Board

A Monopoly-style game engine with a **Three.js 3D board**, an **expectiminimax AI** that plans through dice uncertainty, an interactive **decision-tree visualizer**, and an in-browser **AI training lab** (tournaments + genetic algorithm).

<!-- TODO: drop a real gameplay screenshot here (src/assets/hero.png is a template placeholder) -->
<!-- ![Gameplay](docs/screenshot.png) -->

---

## ✨ What's inside

| | Feature | Where |
|---|---------|-------|
| 🧠 | **Expectiminimax AI** — buy/pass decisions searched through the full 2d6 distribution, 1–4 ply lookahead, phase-adaptive evaluation | `src/ai/` |
| 🌳 | **Decision tree visualizer** — live canvas tree of the AI's last buying decision, expandable branch explorer, selectable lookahead depth | `src/ui/treeVisualizer.js` |
| 🎨 | **3D board** — felt & mahogany board, metallic tokens, hopping pawn animations, tumbling 3D dice, houses/hotels, orbit camera (isometric / top-down / follow-pawn) — plus a classic **2D grid toggle** | `src/render/` |
| 🧬 | **AI Lab** — headless tournaments (20/50/100 games), genetic-algorithm weight evolution via self-play, manual weight sliders | `src/ai/trainer.js` |
| 🤝 | **Deeds & trading** — click any tile for the title deed (build / sell / mortgage / unmortgage); the AI accepts trades only if they improve its evaluation | `src/ui/tradeModal.js` |
| 🔊 | **Synthesized audio** — dice shakes, cash chimes, jail clanks, victory fanfare, all generated with the Web Audio API (zero asset downloads) | `src/audio/soundManager.js` |

---

## 🧠 How the AI works

The AI is a classic game-tree search adapted for dice: an **expectiminimax** search, where chance nodes average over randomness instead of assuming an adversarial die.

### 1. The search tree

Every buying decision builds this tree:

```
                         ┌────────────────────────────┐
                         │  MAX · "Land on Illinois"  │   ply 1 — the buy/pass decision
                         └─────────────┬──────────────┘
                    ┌──────────────────┴──────────────────┐
              ┌─────▼─────┐                         ┌─────▼─────┐
              │    BUY    │                         │   PASS    │          (both simulated on a clone)
              └─────┬─────┘                         └─────┬─────┘
                    │  CHANCE · full 2d6 distribution      │
      ┌──────────┬──┴─────┬─────┬───────┬─────────┐      │
      ▼          ▼        ▼     ▼       ▼         ▼      ...
   roll 2     roll 3   roll 4  ...    roll 11   roll 12        ply 2 — AI's next dice outcome
   P=1/36     P=2/36   P=3/36 ...    P=2/36    P=1/36
      │
      │  MIN · primary opponent responds (averaged over their dice)   ply 3
      ▼
   roll 2 … roll 12  →  CHANCE · AI's following roll                ply 4
      │
      ▼
   leaf evaluation V(s)
```

- **MAX nodes** — the AI's own decisions. The root compares **BUY** vs **PASS**; future purchases inside the tree use a greedy policy (buy if affordable with a $100 liquidity buffer).
- **CHANCE nodes** — every possible dice sum 2–12, weighted by the exact binomial distribution: `P(d) = (6 − |7 − d|) / 36` (so a 7 counts 6/36, snake eyes 1/36).
- **MIN layer** — the primary opponent's response. Their moves are stochastic (dice + greedy purchases), so this layer **averages over the opponent's dice distribution** rather than assuming a hostile die — the honest model of how the opponent actually behaves.

The score of a chance node is the probability-weighted expectation of its children:

```
E(node) = Σ P(roll) · V(state after roll)
```

**Ply accounting:** the initial buy/pass choice is ply 1, the AI's next dice outcome is ply 2, the opponent's response is ply 3, and the AI's following roll is ply 4. Depth is clamped to 1–4 (default **3** in live matches; changes apply to the next buying decision and survive a match reset).

**Cost:** one buy decision expands `2 × 11^(depth−1)` leaf evaluations (2 branches × 11 dice outcomes per ply) — a 4-ply search evaluates ~2,662 states. All simulation happens on fast state clones, so the live game is never mutated by a search.

### 2. The evaluation function `V(s)`

At the leaves, a heuristic scores the position from the AI's perspective:

```
V(s) =  w.cash · cash
      + w.propertyValue · property equity        (mortgaged props count at mortgage value)
      + w.houseValue · house equity               (×1.3 bonus per house at exactly 3 houses — Monopoly's ROI sweet spot)
      + monopoly bonuses                          (complete sets: +900 base, partial 2/3 sets: +250)
      + w.expectedIncome · E[rent earned]         (probability-weighted rent opponents will pay next roll)
      − w.expectedHazard · E[rent owed]           (probability-weighted rent the AI might pay next roll)
      + w.jailValue                               (phase-dependent — see below)
      + 40 · get-out-of-jail-free cards
      + 0.4 · (my net worth − avg opponent net worth)
```

with terminal values of **+100,000** for winning, **−100,000** for losing, and **−50,000** for bankruptcy.

Two details that matter a lot in Monopoly are baked in:

- **Board traffic**: completed color sets in high-traffic zones get a multiplier — **orange ×1.35** (the most landed-on group because it's 6–9 rolls from jail), **red ×1.25**, **yellow ×1.15**.
- **Liquidity**: cash under $100 triggers a heavy danger penalty, and bankruptcy risk is priced at 5,000 points.

### 3. Phase-adaptive weights

`getGamePhase()` counts unowned properties to detect the game stage, and the evaluator rescales its weights accordingly:

| Phase | Condition | Strategy shift |
|-------|-----------|----------------|
| **Early** — land grab | > 10 unowned | Property value ×1.5, houses ×0.8, jail valued at **−250** (pay the $50, get out, grab land) |
| **Mid** — monopoly assembly | > 2 unowned | Complete sets ×1.5, houses ×1.8, income ×1.5, jail is neutral |
| **Late** — survival | ≤ 2 unowned | Cash ×1.4, hazard ×2.0, income ×1.8, jail valued at **+350** — staying behind bars dodges lethal hotels |

On top of that: a player near the $4,000 win-target doubles down on cash liquidity and hazard avoidance, and anyone under $150 cash enters "crisis mode" (cash ×2, hazard ×2.5).

### 4. Beyond buying: the other decisions

The expectiminimax search handles the buy/pass root, but the same evaluation function drives the rest of the AI's turn:

- **Building** — builds evenly within completed sets while the evaluated score improves (or until 3 houses, the known ROI sweet spot), always keeping a ~$200–250 cash reserve.
- **Jail strategy** — use a jail-free card first; pay $50 immediately in the early game; in the late game roll for doubles and only pay when forced on the third turn.
- **Unmortgaging** — pays off mortgaged property (at 10% interest) only when cash stays above a $250 buffer afterwards.
- **Trades** — a proposed trade is evaluated by cloning the state, executing the trade, and accepting only if `V(s)` increases.

---

## 🎭 AI personalities

Five profiles ship with the game — same search, different weights:

| Profile | Style | Key weight differences |
|---------|-------|------------------------|
| 🧠 **Minimax Grandmaster** | Balanced baseline | Default weights |
| ⚡ **Aggressive Monopolist** | All-in land grab | Cash ×0.6, sets +1400, houses ×2.2, low hazard fear |
| 🛡️ **Cautious Capitalist** | Liquidity first | Cash ×2.2, houses ×1.1, hazard ×4.5, bankruptcy penalty ×1.8 |
| 🚂 **Transit & Utility Baron** | Railroads & Orange | Sets +1100, expected income ×4.5 |
| 🎲 **Novice Heuristic** | 1-ply baseline | No lookahead — used as the GA's sparring partner |

In headless benchmarks the `minimax` profile defaults to 2-ply; live matches default to 3-ply and can be switched to 4.

---

## 🧬 AI Lab

The in-browser training studio (🎮 **AI Lab** button) runs everything headlessly — no rendering, just the state machine:

- **Tournament benchmark** — simulate 20/50/100 games between any two profiles in seconds; get win rates, average turns, and average final net worth (starting player alternates each game for fairness).
- **Genetic algorithm** — evolves evaluation weights through self-play: population of 6, fitness = `win rate × 1000 + avg net worth × 0.2`, top-50% survival, uniform crossover, 15% mutation.
- **Manual tuning** — live sliders for liquidity, monopoly bonus, house ROI, and hazard aversion.

---

## 🚀 Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
git clone <repo-url>
cd Project
npm install
npm run dev        # → http://localhost:5173
```

**Build for production:**

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built version
```

**Tests:**

```bash
npm test           # node:test suite — verifies search depth, ply accounting,
                   # full dice distribution, terminal handling, and search purity
node test_sim.js   # headless smoke run: engine init, decisions, AI vs AI match, tournament
```

---

## 🏆 Game modes

1. **Human vs AI** — play against the expectiminimax engine with adjustable lookahead.
2. **AI vs AI (Spectate)** — watch two personalities battle at 1×, 2×, 5×, or 20× turbo speed.
3. **4-Agent AI Royale** — Grandmaster vs Aggressive Monopolist vs Cautious Capitalist vs Transit Baron.

---

## 📂 Project structure

```
Project/
├── index.html                 # Main layout: top bar, HUD, modals
├── test_sim.js                # Headless smoke test for engine & AI
├── tests/
│   └── searchDepth.test.js    # Search-depth & tree-shape unit tests (node:test)
├── public/                    # Static assets: icons, dice faces, textures
└── src/
    ├── main.js                # App controller & game loop
    ├── style.css              # Dark glassmorphic design system
    ├── engine/
    │   ├── boardData.js       # 40 squares, official rents, cards, dice probabilities
    │   └── gameState.js       # State machine: movement, rent, bankruptcy, trades, cloning
    ├── ai/
    │   ├── evaluator.js       # Heuristic V(s) & phase-adaptive weights
    │   ├── expectiminimax.js  # Search engine & decision-tree generator
    │   ├── aiProfiles.js      # The five AI personalities
    │   └── trainer.js         # Headless tournaments & genetic algorithm
    ├── render/
    │   ├── threeBoard.js      # Three.js board, tokens, dice, animations
    │   └── twoDBoard.js       # Classic 11×11 grid board
    ├── audio/
    │   └── soundManager.js    # Web Audio API synthesizer
    └── ui/
        ├── dashboard.js       # Player HUDs, deed inspector, toasts
        ├── treeVisualizer.js  # Canvas decision-tree renderer
        ├── trainerModal.js    # AI Lab modal
        ├── tradeModal.js      # Trade negotiation modal
        └── tokens.js          # SVG player-token silhouettes
```

---

## 🛠 Tech stack

- **[Three.js](https://threejs.org/)** — 3D rendering, procedural textures, animation
- **Vite** — dev server & production bundling
- **Web Audio API** — procedural sound synthesis
- **Canvas 2D** — decision-tree visualization
- **node:test** — unit tests (no extra dependencies)
