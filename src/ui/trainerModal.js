import { AITrainer } from '../ai/trainer.js';
import { AIProfiles } from '../ai/aiProfiles.js';
import { DefaultWeights } from '../ai/evaluator.js';

export class TrainerModal {
  constructor(containerEl, onWeightsUpdated = null) {
    this.container = containerEl;
    this.onWeightsUpdated = onWeightsUpdated;
    this.isRunning = false;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="trainer-modal">
        <div class="modal-panel trainer-panel">
          <div class="modal-header">
            <div class="modal-title">
              <div>
                <h3>AI Training Studio</h3>
                <p>Simulate headless tournaments &amp; tune the Expectiminimax weights</p>
              </div>
            </div>
            <button class="modal-close" id="btn-close-trainer" aria-label="Close AI Lab"><svg width="16" height="16"><use href="#i-close"/></svg></button>
          </div>

          <div class="trainer-tabs">
            <button class="tab-btn active" data-tab="benchmark">Tournament</button>
            <button class="tab-btn" data-tab="genetic">Evolution Training</button>
            <button class="tab-btn" data-tab="manual">Weight Tuning</button>
          </div>

          <!-- Tab 1: Tournament Benchmark -->
          <div class="tab-content active" id="tab-benchmark">
            <div class="benchmark-setup">
              <div class="form-row">
                <label>Player 1 (Candidate):</label>
                <select id="bench-p1" class="select-input">
                  <option value="minimax" selected>Minimax Grandmaster (Trained)</option>
                  <option value="aggressive">Aggressive Monopolist</option>
                  <option value="cautious">Cautious Capitalist</option>
                  <option value="baron">Transit Baron</option>
                </select>
              </div>
              <div class="form-row">
                <label>Player 2 (Opponent):</label>
                <select id="bench-p2" class="select-input">
                  <option value="novice" selected>Novice Heuristic (Baseline)</option>
                  <option value="cautious">Cautious Capitalist</option>
                  <option value="aggressive">Aggressive Monopolist</option>
                  <option value="minimax">Minimax Grandmaster</option>
                </select>
              </div>
              <div class="form-row">
                <label>Matches to Simulate:</label>
                <select id="bench-count" class="select-input">
                  <option value="20">20 Fast Matches</option>
                  <option value="50" selected>50 Matches (Recommended)</option>
                  <option value="100">100 Matches (Deep Statistical Sample)</option>
                </select>
              </div>
              <button class="btn btn-primary btn-block" id="btn-run-benchmark">Run Tournament</button>
            </div>

            <!-- Progress Bar -->
            <div class="progress-container hidden" id="bench-progress-box">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" id="bench-progress-bar"></div>
              </div>
              <div class="progress-label" id="bench-progress-label">Simulating match 0/50...</div>
            </div>

            <!-- Results Card -->
            <div class="bench-results hidden" id="bench-results-box">
              <div class="results-header">BENCHMARK RESULTS</div>
              <div class="win-rate-bar-container">
                <div class="win-segment p1-seg" id="p1-win-seg" style="width: 50%">P1: 50%</div>
                <div class="win-segment p2-seg" id="p2-win-seg" style="width: 50%">P2: 50%</div>
              </div>
              <div class="stats-table" id="bench-stats-table"></div>
            </div>
          </div>

          <!-- Tab 2: Genetic Algorithm Training -->
          <div class="tab-content" id="tab-genetic">
            <p class="tab-desc">The Genetic Trainer creates a population of mutating weight vectors, plays tournament generations against the baseline, and breeds the highest-performing configurations.</p>
            <div class="benchmark-setup">
              <div class="form-row">
                <label>Evolution Generations:</label>
                <input type="number" id="gen-count" class="num-input" value="4" min="2" max="10">
              </div>
              <div class="form-row">
                <label>Population Size:</label>
                <input type="number" id="pop-size" class="num-input" value="6" min="4" max="10">
              </div>
              <button class="btn btn-success btn-block" id="btn-run-genetic">Begin Evolution Training</button>
            </div>

            <div class="progress-container hidden" id="gen-progress-box">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" id="gen-progress-bar" style="width: 0%"></div>
              </div>
              <div class="progress-label" id="gen-progress-label">Training Generation 1...</div>
            </div>

            <div class="gen-log-box" id="gen-log"></div>
          </div>

          <!-- Tab 3: Manual Weight Tuning -->
          <div class="tab-content" id="tab-manual">
            <p class="tab-desc">Fine-tune the heuristic evaluation parameters. These weights determine how the AI values cash vs monopolies vs rent hazard.</p>
            <div class="weight-sliders" id="weight-sliders-list"></div>
            <div class="slider-actions">
              <span class="save-note" id="weights-saved-note">Weights applied to the Minimax Grandmaster.</span>
              <button class="btn btn-secondary" id="btn-reset-weights"><svg width="14" height="14"><use href="#i-reset"/></svg> Reset</button>
              <button class="btn btn-primary" id="btn-save-weights">Save Weights</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderWeightSliders();
  }

  renderWeightSliders(weights = DefaultWeights) {
    const list = document.getElementById('weight-sliders-list');
    if (!list) return;

    const descriptions = {
      cash: 'Cash Liquidity Priority',
      propertyValue: 'Property Value Multiplier',
      monopolyComplete: 'Monopoly Completion Bonus',
      monopolyPartial: 'Partial Set (2/3) Synergy',
      houseValue: 'House Development ROI',
      expectedIncome: 'Opponent Rent Traffic Weight',
      expectedHazard: 'Rent Hazard Avoidance'
    };

    list.innerHTML = Object.entries(weights)
      .filter(([k]) => descriptions[k])
      .map(([k, v]) => `
        <div class="slider-item">
          <div class="slider-label">
            <span>${descriptions[k]}</span>
            <span class="slider-val" id="val-${k}">${typeof v === 'number' ? (v > 10 ? Math.round(v) : v.toFixed(1)) : v}</span>
          </div>
          <input type="range" class="weight-slider" data-key="${k}"
                 min="${k === 'cash' ? 0.2 : k.includes('monopoly') ? 100 : 0.5}"
                 max="${k === 'cash' ? 5.0 : k.includes('monopoly') ? 2500 : 8.0}"
                 step="${k.includes('monopoly') ? 50 : 0.1}"
                 value="${v}">
        </div>
      `).join('');

    list.querySelectorAll('.weight-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.getAttribute('data-key');
        const val = parseFloat(e.target.value);
        document.getElementById(`val-${key}`).textContent = val > 10 ? Math.round(val) : val.toFixed(1);
      });
    });
  }

  bindEvents() {
    // Open/Close
    document.getElementById('btn-close-trainer')?.addEventListener('click', () => this.close());

    // Tab Navigation
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
      });
    });

    // Run Benchmark
    document.getElementById('btn-run-benchmark')?.addEventListener('click', async () => {
      if (this.isRunning) return;
      this.isRunning = true;

      const p1Key = document.getElementById('bench-p1').value;
      const p2Key = document.getElementById('bench-p2').value;
      const count = parseInt(document.getElementById('bench-count').value, 10);

      const p1Profile = AIProfiles[p1Key];
      const p2Profile = AIProfiles[p2Key];

      const progBox = document.getElementById('bench-progress-box');
      const progBar = document.getElementById('bench-progress-bar');
      const progLbl = document.getElementById('bench-progress-label');
      const resBox = document.getElementById('bench-results-box');

      progBox.classList.remove('hidden');
      progBar.style.transform = 'scaleX(0)';
      resBox.classList.add('hidden');

      const results = await AITrainer.runBenchmark(p1Profile, p2Profile, count, (p) => {
        progBar.style.transform = `scaleX(${p.completed / p.total})`;
        progLbl.textContent = `Match ${p.completed}/${p.total} (P1: ${p.p1Wins} - P2: ${p.p2Wins})...`;
      });

      progBox.classList.add('hidden');
      resBox.classList.remove('hidden');

      const p1Pct = parseFloat(results.p1WinRate);
      const p2Pct = parseFloat(results.p2WinRate);

      document.getElementById('p1-win-seg').style.width = `${p1Pct}%`;
      document.getElementById('p1-win-seg').textContent = `${p1Profile.name}: ${results.p1WinRate}`;
      document.getElementById('p2-win-seg').style.width = `${p2Pct}%`;
      document.getElementById('p2-win-seg').textContent = `${p2Profile.name}: ${results.p2WinRate}`;

      document.getElementById('bench-stats-table').innerHTML = `
        <div class="stat-col"><span>Total matches:</span> <strong>${results.numGames}</strong></div>
        <div class="stat-col"><span>Avg turns to victory:</span> <strong>${results.avgTurns}</strong></div>
        <div class="stat-col"><span>P1 wins:</span> <strong style="color:var(--brass-600)">${results.p1Wins}</strong></div>
        <div class="stat-col"><span>P2 wins:</span> <strong style="color:var(--oxblood-600)">${results.p2Wins}</strong></div>
        <div class="stat-col"><span>P1 avg net worth:</span> <strong>$${results.p1AvgNetWorth.toLocaleString()}</strong></div>
        <div class="stat-col"><span>P2 avg net worth:</span> <strong>$${results.p2AvgNetWorth.toLocaleString()}</strong></div>
      `;

      this.isRunning = false;
    });

    // Run Genetic Training
    document.getElementById('btn-run-genetic')?.addEventListener('click', async () => {
      if (this.isRunning) return;
      this.isRunning = true;

      const gens = parseInt(document.getElementById('gen-count').value, 10);
      const popSize = parseInt(document.getElementById('pop-size').value, 10);

      const progBox = document.getElementById('gen-progress-box');
      const progBar = document.getElementById('gen-progress-bar');
      const progLbl = document.getElementById('gen-progress-label');
      const logBox = document.getElementById('gen-log');

      progBox.classList.remove('hidden');
      progBar.style.transform = 'scaleX(0)';
      logBox.innerHTML = '<div class="gen-log-entry info">Starting evolution training…</div>';

      const res = await AITrainer.trainGenetic({
        generations: gens,
        populationSize: popSize,
        gamesPerMatch: 6,
        onEpoch: (data) => {
          progBar.style.transform = `scaleX(${data.generation / data.totalGenerations})`;
          progLbl.textContent = `Generation ${data.generation}/${data.totalGenerations} complete!`;

          const div = document.createElement('div');
          div.className = 'gen-log-entry';
          div.innerHTML = `<strong>Gen ${data.generation}:</strong> Top fitness ${data.best.fitness.toFixed(0)} · win rate ${data.best.winRate}`;
          logBox.appendChild(div);
          logBox.scrollTop = logBox.scrollHeight;
        }
      });

      progBox.classList.add('hidden');
      const finalDiv = document.createElement('div');
      finalDiv.className = 'gen-log-entry success';
      finalDiv.innerHTML = `<strong>Training complete.</strong> Optimal weights evolved and applied to the Minimax Grandmaster.`;
      logBox.appendChild(finalDiv);

      // Apply best weights to Minimax profile
      AIProfiles.minimax.weights = { ...res.bestWeights };
      this.renderWeightSliders(res.bestWeights);
      if (this.onWeightsUpdated) {
        this.onWeightsUpdated(res.bestWeights);
      }

      this.isRunning = false;
    });

    // Manual Weights Save / Reset
    document.getElementById('btn-reset-weights')?.addEventListener('click', () => {
      this.renderWeightSliders(DefaultWeights);
      document.getElementById('weights-saved-note')?.classList.remove('visible');
    });

    document.getElementById('btn-save-weights')?.addEventListener('click', () => {
      const custom = { ...DefaultWeights };
      this.container.querySelectorAll('.weight-slider').forEach(slider => {
        const k = slider.getAttribute('data-key');
        custom[k] = parseFloat(slider.value);
      });

      AIProfiles.minimax.weights = custom;
      if (this.onWeightsUpdated) {
        this.onWeightsUpdated(custom);
      }

      const note = document.getElementById('weights-saved-note');
      if (note) {
        note.classList.add('visible');
        setTimeout(() => note.classList.remove('visible'), 2600);
      }
    });
  }

  open() {
    document.getElementById('trainer-modal')?.classList.add('open');
  }

  close() {
    document.getElementById('trainer-modal')?.classList.remove('open');
  }
}
