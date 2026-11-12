# 🎲 Monopoly AI — Expectiminimax Game Engine & 3D Visualizer

An intelligent, state-of-the-art Monopoly-style board game engine built with **Three.js 3D WebGL**, interactive **Expectiminimax Game Tree Search**, dynamic strategy adaptation, and an in-browser **AI Training & Benchmark Studio**.

---

## 🌟 Key Features

### 1. 🧠 Expectiminimax Game Tree AI
- **Game Tree Architecture**:
  - **MAX Nodes (AI Turn)**: Evaluates all candidate actions (Buy Property, Pass, Build Houses/Hotels, Mortgage/Unmortgage, Jail Strategy, Trade Proposals).
  - **CHANCE Nodes (Dice Rolls & Cards)**: Models the exact binomial probability distribution of 2d6 dice rolls ($P(d) = \frac{6 - |7 - d|}{36}$ for rolls $2$ through $12$) to calculate expected values across all possible future positions.
  - **MIN Nodes (Opponent Responses)**: Simulates opponent counter-actions and future rent payments.
- **Dynamic Heuristic Evaluation $V(s)$**:
  $$V(s) = w_1 \cdot \text{Cash} + w_2 \cdot \text{PropEquity} + w_3 \cdot \text{MonopolyBonus} + w_4 \cdot \text{HouseROI} + w_5 \cdot \mathbb{E}[\text{Income}] - w_6 \cdot \mathbb{E}[\text{Hazard}] - w_7 \cdot \text{BankruptcyRisk}$$
- **Adaptive Strategic Phases**:
  - **Early Game (Land Grab)**: High weight on acquiring any unowned property; jail is penalizing (rush to exit).
  - **Mid Game (Monopoly Assembly)**: High priority on completing color sets and reaching 3 houses (the optimal Monopoly ROI sweet spot).
  - **Late Game (Survival & Minefield)**: High liquidity safety buffer; jail becomes a safe sanctuary to avoid opponent hotels!

### 2. 🌳 Real-Time Decision Tree Visualizer
- Use **Lookahead** in the AI Decision Tree panel to select **2, 3, or 4 ply**. Live matches default to **3 ply**; changes apply to the next AI buying decision and survive a match reset.
- The initial buy/pass decision is ply 1, the next AI dice outcome is ply 2, the primary opponent's response is ply 3, and the following AI roll is ply 4. Both players' dice outcomes use the full 2d6 distribution; future purchases use the existing greedy policy.
- Select a dice outcome and choose **Explore continuation** to inspect deeper branches. **Back to decision** returns to the buying comparison. The expanded view holds the decision steady while you inspect it and shows the latest decision when closed. Four-ply search evaluates more states and takes longer than three ply.
- An interactive, live **Canvas-based Game Tree Visualizer** in the sidebar.
- Displays root decision state $\rightarrow$ Action branches $\rightarrow$ Chance dice outcomes $\rightarrow$ Leaf evaluations.
- Highlights the optimal branch chosen by Expectiminimax in glowing emerald green with exact expected value deltas and mathematical reasoning!

### 3. 🎨 High-Fidelity 3D Board (Three.js) & 2D Classic Toggle
- **3D WebGL Viewport**:
  - Vintage felt & mahogany beveled board with procedural textures and crisp color banners.
  - Distinct metallic luxury player tokens (Top Hat, Roadster Car, Battleship, Classic Pawn).
  - Smooth multi-step **hopping animations** around board corners with parabolic jumping physics.
  - 3D tumbling dice rolls that spin, bounce, and settle flat on the rolled pips.
  - Real 3D green cottages and red hotels rendered on deeds upon upgrade.
  - Smooth orbit camera with Isometric 3D, Top-Down Tactical, and Follow-Pawn modes.
- **2D Classic Grid Toggle**:
  - Seamless 1-click switch to a responsive 11x11 classic grid view.

### 4. 🧬 AI Training & Benchmark Studio (AI Lab)
- **Headless Tournament Benchmark**:
  - Simulates 20, 50, or 100 fast-forward matches without animation latency in seconds.
  - Compares win rates, average turns to bankruptcy, and average final net worth.
- **Genetic Algorithm Training**:
  - Population-based weight evolution across generations through self-play tournament selection.
- **Manual Weight Sliders**:
  - Tweak liquidity preference, monopoly bonus, house ROI, and hazard avoidance in real-time.

### 5. 🤝 Property Deeds & Trade Negotiation
- Click any 3D or 2D tile to inspect the **Title Deed** with full rent breakdown and direct management (Build, Sell, Mortgage, Unmortgage).
- Propose trades to AI agents (cash and properties). The AI uses Expectiminimax to evaluate whether the proposal increases its expected game outcome.

### 6. 🔊 Synthesized Web Audio API Sound Effects
- Pure browser Web Audio synthesis: dice shakes, cash register chimes, hammer taps, jail door clanks, and victory fanfares without any external asset dependencies.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) & npm

### Installation
```bash
git clone <repo-url>
cd Project
npm install
```

### Running Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Headless Verification Test
To run the automated game engine and Expectiminimax test suite:
```bash
node test_sim.js
```

---

## 📂 Project Architecture

```
Project/
├── index.html                 # Main interface layout, top bar, HUD, modals
├── package.json               # Dependencies (Three.js, canvas-confetti, Vite)
├── test_sim.js                # Headless verification script for engine & AI
├── public/                    # Classic icons, dice graphics, and textures
└── src/
    ├── main.js                # Master application controller and game loop
    ├── style.css              # Dark glassmorphic design system & animations
    ├── engine/
    │   ├── boardData.js       # 40 squares, official Monopoly rents, cards, probabilities
    │   └── gameState.js       # Core state machine, fast cloning, events, transactions
    ├── ai/
    │   ├── evaluator.js       # Heuristic evaluation function & phase-adaptive weights
    │   ├── expectiminimax.js  # Expectiminimax search engine & decision tree generator
    │   ├── aiProfiles.js      # Strategic profiles (Minimax, Aggressive, Cautious, etc.)
    │   └── trainer.js         # Headless tournament simulator & Genetic Algorithm
    ├── render/
    │   ├── threeBoard.js      # Three.js 3D board, tokens, 3D dice, and hopping physics
    │   └── twoDBoard.js       # Responsive 11x11 2D classic grid board
    ├── audio/
    │   └── soundManager.js    # Web Audio API sound effect synthesizer
    └── ui/
        ├── dashboard.js       # Player HUDs, deed inspector, toast alerts, controls
        ├── treeVisualizer.js  # Interactive canvas-based Minimax decision tree renderer
        ├── trainerModal.js    # AI benchmark & evolutionary training studio modal
        └── tradeModal.js      # Expectiminimax trade negotiation modal
```

---

## 🏆 Game Modes
1. **Human vs AI**: Test your skills against the Expectiminimax Grandmaster!
2. **AI vs AI (Spectate)**: Watch two distinct AI personalities battle autonomously at 1x, 2x, 5x, or 20x Turbo speed.
3. **4-Agent AI Royale**: A 4-way clash between Minimax Grandmaster, Aggressive Monopolist, Cautious Capitalist, and Transit Baron.
# MonopolyAI
