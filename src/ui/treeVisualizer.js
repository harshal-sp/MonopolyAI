// Keep the full decision diagram readable, independent of the ledger's height.
export class GameTreeVisualizer {
  constructor(container) {
    this.container = container;
    this.home = container.parentElement;
    this.zoom = 1;
    this.treeData = null;
    this.nodes = [];
    this.edges = [];
    this.selectedNode = null;
    container.innerHTML = `
      <div class="tree-toolbar" aria-label="Decision tree controls">
        <div class="tree-zoom-controls">
          <button class="btn btn-secondary btn-sm" data-tree="out" aria-label="Zoom tree out">−</button>
          <output class="tree-zoom-value" aria-label="Tree zoom">100%</output>
          <button class="btn btn-secondary btn-sm" data-tree="in" aria-label="Zoom tree in">+</button>
          <button class="btn btn-secondary btn-sm" data-tree="fit">Fit</button>
        </div>
        <button class="btn btn-secondary btn-sm" data-tree="expand">Expand tree</button>
      </div>
      <p class="tree-explanation"></p>
      <div class="tree-legend"><span>Green / gold: chosen action</span><span>Bars: expected outcome scores</span></div>
      <div class="tree-viewport" tabindex="0" aria-label="Decision diagram. Scroll to explore when zoomed."></div>
      <div class="tree-inspector">
        <label>Inspect node <select aria-label="Inspect tree node"></select></label>
        <p class="tree-node-detail" role="status"></p>
        <div class="tree-branch-controls">
          <button class="btn btn-secondary btn-sm" data-tree="branch" disabled>Explore continuation</button>
          <button class="btn btn-secondary btn-sm" data-tree="back" disabled>Back to decision</button>
        </div>
      </div>`;
    this.viewport = container.querySelector('.tree-viewport');
    this.explanationEl = container.querySelector('.tree-explanation');
    this.nodeSelect = container.querySelector('select');
    this.detailEl = container.querySelector('.tree-node-detail');
    this.branchButton = container.querySelector('[data-tree="branch"]');
    this.backButton = container.querySelector('[data-tree="back"]');
    this.branchButton.addEventListener('click', () => {
      if (!this.selectedNode?.data.children?.length) return;
      this.showBranch(this.selectedNode.data);
    });
    this.backButton.addEventListener('click', () => this.showBranch(this.treeData));
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'AI decision tree. Use Inspect node below for full labels, probabilities, and scores.');
    this.ctx = this.canvas.getContext('2d');
    this.viewport.appendChild(this.canvas);
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'tree-expanded';
    this.dialog.setAttribute('aria-label', 'Expanded AI decision tree');
    document.body.appendChild(this.dialog);
    this.dialog.addEventListener('close', () => {
      this.home.appendChild(this.container);
      this.container.querySelector('[data-tree="expand"]').textContent = 'Expand tree';
      if (this.pendingTree) {
        const { treeData, explanation } = this.pendingTree;
        this.setTree(treeData, explanation);
      }
      this.resize();
      this.container.querySelector('[data-tree="expand"]').focus();
    });
    container.querySelector('[data-tree="expand"]').addEventListener('click', () => {
      if (this.dialog.open) this.dialog.close();
      else {
        this.dialog.appendChild(container);
        this.dialog.showModal();
        container.querySelector('[data-tree="expand"]').textContent = 'Close large view';
        this.resize();
      }
    });
    container.querySelector('[data-tree="in"]').addEventListener('click', () => this.setZoom(this.zoom + 0.25));
    container.querySelector('[data-tree="out"]').addEventListener('click', () => this.setZoom(this.zoom - 0.25));
    container.querySelector('[data-tree="fit"]').addEventListener('click', () => {
      this.setZoom(1);
      this.viewport.scrollTo(0, 0);
    });
    this.nodeSelect.addEventListener('change', () => this.selectNode(this.nodes.find(n => n.id === this.nodeSelect.value)));
    this.canvas.addEventListener('click', e => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / this.zoom;
      const y = (e.clientY - rect.top) / this.zoom;
      const hit = this.nodes.find(n => x >= n.x - n.w / 2 && x <= n.x + n.w / 2 && y >= n.y - n.h / 2 && y <= n.y + n.h / 2);
      if (hit) this.selectNode(hit);
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.setTree(null);
  }

  setZoom(value) {
    this.zoom = Math.max(0.75, Math.min(2.5, Math.round(value * 4) / 4));
    this.container.querySelector('.tree-zoom-value').textContent = `${Math.round(this.zoom * 100)}%`;
    this.container.querySelector('[data-tree="out"]').disabled = this.zoom <= 0.75;
    this.container.querySelector('[data-tree="in"]').disabled = this.zoom >= 2.5;
    this.resize();
  }

  resize() {
    this.width = Math.max(320, this.viewport.clientWidth);
    this.height = Math.max(380, this.viewport.clientHeight);
    const scale = (window.devicePixelRatio || 1) * this.zoom;
    this.canvas.width = Math.round(this.width * scale);
    this.canvas.height = Math.round(this.height * scale);
    this.canvas.style.width = `${this.width * this.zoom}px`;
    this.canvas.style.height = `${this.height * this.zoom}px`;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.computeLayout();
    this.render();
  }

  setTree(treeData, explanation = '') {
    // Keep a decision stable while its deeper branches are being inspected.
    // The game continues, and the latest decision is shown when the view closes.
    if (this.dialog.open && this.treeData && treeData) {
      this.pendingTree = { treeData, explanation };
      return;
    }
    this.pendingTree = null;
    this.treeData = treeData;
    this.viewRoot = treeData;
    this.selectedNode = null;
    this.explanationEl.textContent = `${treeData?.depth ? `${treeData.depth}-ply search · ` : ''}${explanation || 'The latest AI buying decision appears here. Wait for an AI player to land on an unowned property.'}`;
    this.computeLayout();
    this.updateNodeOptions();
  }

  showBranch(root) {
    this.viewRoot = root;
    this.selectedNode = null;
    this.computeLayout();
    this.updateNodeOptions();
    this.viewport.scrollTo(0, 0);
  }

  updateNodeOptions() {
    this.backButton.disabled = this.viewRoot === this.treeData;
    this.branchButton.disabled = true;
    this.nodeSelect.replaceChildren(...this.nodes.map(node => {
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${node.type}: ${node.text}`;
      return option;
    }));
    this.nodeSelect.disabled = !this.nodes.length;
    if (this.nodes.length) this.selectNode(this.nodes[0]);
    else {
      this.detailEl.textContent = 'Select a node or a dice bar to read its complete evaluation.';
      this.render();
    }
  }

  selectNode(node) {
    if (!node) return;
    this.selectedNode = node;
    this.nodeSelect.value = node.id;
    const probability = node.data.probability;
    this.detailEl.textContent = [
      node.data.details || node.data.action || node.text,
      node.score !== undefined ? `Score: ${Number(node.score).toLocaleString()}` : '',
      probability !== undefined ? `Probability: ${(probability * 100).toFixed(1)}%` : '',
      node.data.chosen ? 'Chosen action' : ''
    ].filter(Boolean).join(' · ');
    this.branchButton.disabled = node.kind !== 'bar' || !node.data.children?.length;
    this.render();
    this.onNodeSelected?.(node);
  }

  computeLayout() {
    this.nodes = [];
    this.edges = [];
    if (!this.treeData) return;
    const rootData = this.viewRoot || this.treeData;
    const rootType = rootData.type || 'MAX';
    const root = {
      id: 'root', text: rootData.name || `After roll ${String(rootData.action).match(/roll\s*(\d+)/i)?.[1] || ''}`,
      subtext: rootData.score === undefined ? `${rootType} · AI decision` : `${rootType} · EV ${Number(rootData.score).toLocaleString()}`,
      type: rootType, x: this.width / 2, y: 52, w: Math.min(300, this.width - 32), h: 76,
      chosen: true, score: rootData.score, data: rootData
    };
    this.nodes.push(root);
    const actions = rootData.children || [];
    // Each action owns a lane so its outcomes cannot overlap another branch.
    const laneWidth = (this.width - 24) / Math.max(1, actions.length);
    const baseline = this.height - 64;
    const scores = actions.flatMap(a => (a.children || []).map(r => Number(r.score) || 0));
    this.minScore = scores.length ? Math.min(...scores) : 0;
    this.maxScore = scores.length ? Math.max(...scores) : 1;
    actions.forEach((action, index) => {
      const x = 12 + laneWidth * (index + 0.5);
      const node = {
        id: `act_${index}`, text: action.action || 'Action', subtext: `EV ${Number(action.score || 0).toLocaleString()}`,
        type: action.type || 'CHANCE', x, y: 169, w: laneWidth - 12, h: 100,
        chosen: !!action.chosen, score: action.score, data: action
      };
      this.nodes.push(node);
      this.edges.push({ from: root, to: node, chosen: node.chosen });
      const rolls = action.children || [];
      const step = Math.min(36, (laneWidth - 20) / Math.max(1, rolls.length));
      rolls.forEach((roll, rollIndex) => {
        const score = Number(roll.score) || 0;
        const fraction = (score - this.minScore) / (this.maxScore - this.minScore || 1);
        const barHeight = 24 + fraction * Math.max(40, baseline - 278);
        const leaf = {
          id: `roll_${index}_${rollIndex}`, text: roll.action || 'Dice outcome', type: roll.type || 'LEAF', kind: 'bar',
          x: x + (rollIndex - (rolls.length - 1) / 2) * step,
          y: baseline - barHeight / 2, w: Math.max(6, step - 3), h: barHeight,
          baseline, rollLabel: String(roll.action).match(/roll\s*(\d+)/i)?.[1] || String(rollIndex + 2),
          labelOffset: step < 20 && rollIndex % 2 ? 28 : 14,
          score: roll.score, chosen: node.chosen, data: roll
        };
        this.nodes.push(leaf);
        this.edges.push({ from: node, to: leaf, chosen: node.chosen });
      });
    });
    if (this.selectedNode) this.selectedNode = this.nodes.find(n => n.id === this.selectedNode.id) || null;
  }

  wrapText(text, x, y, width, lineHeight) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.ctx.measureText(next).width > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    lines.forEach((value, index) => this.ctx.fillText(value, x, y + index * lineHeight, width));
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!this.treeData) {
      ctx.fillStyle = '#4c4231';
      ctx.font = '16px Georgia, serif';
      this.wrapText('Waiting for an AI buying decision', this.width / 2, this.height / 2 - 12, this.width - 48, 24);
      return;
    }
    this.edges.forEach(edge => {
      const startY = edge.from.y + edge.from.h / 2;
      const endY = edge.to.y - edge.to.h / 2;
      ctx.beginPath();
      ctx.moveTo(edge.from.x, startY);
      ctx.bezierCurveTo(edge.from.x, (startY + endY) / 2, edge.to.x, (startY + endY) / 2, edge.to.x, endY);
      ctx.strokeStyle = edge.chosen ? '#85692f' : '#9b8b6d';
      ctx.lineWidth = edge.chosen ? 2 : 1;
      ctx.setLineDash(edge.chosen ? [] : [4, 3]);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    this.nodes.forEach(node => {
      const selected = this.selectedNode?.id === node.id;
      const left = node.x - node.w / 2;
      const top = node.y - node.h / 2;
      if (node.kind === 'bar') {
        ctx.fillStyle = node.chosen ? '#85692f' : '#85765c';
        ctx.fillRect(left, top, node.w, node.h);
        if (selected) {
          ctx.strokeStyle = '#241d12';
          ctx.lineWidth = 2;
          ctx.strokeRect(left - 2, top - 2, node.w + 4, node.h + 4);
        }
        ctx.fillStyle = '#241d12';
        ctx.font = '11px monospace';
        ctx.fillText(node.rollLabel, node.x, node.baseline + node.labelOffset);
        return;
      }
      ctx.beginPath();
      ctx.roundRect(left, top, node.w, node.h, 4);
      ctx.fillStyle = node.chosen ? '#264c37' : '#f6efdd';
      ctx.fill();
      ctx.strokeStyle = selected ? '#241d12' : node.chosen ? '#85692f' : '#ac9873';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = node.chosen ? '#f6efdd' : '#241d12';
      ctx.font = 'bold 13px Georgia, serif';
      this.wrapText(node.text, node.x, top + 20, node.w - 20, 17);
      ctx.font = '12px monospace';
      ctx.fillStyle = node.chosen ? '#efe6cf' : '#4c4231';
      ctx.fillText(node.subtext, node.x, top + node.h - 16);
    });
    ctx.fillStyle = '#4c4231';
    ctx.font = '11px monospace';
    const hasLeaves = this.nodes.some(n => n.kind === 'bar');
    ctx.fillText(hasLeaves ? `Dice rolls · outcome scores ${this.minScore}–${this.maxScore}` : 'No dice lookahead for this decision', this.width / 2, this.height - 12);
  }
}
