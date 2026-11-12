import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BoardSquares, ColorGroups, TileTypes, getTileGridCoords } from '../engine/boardData.js';
import { soundManager } from '../audio/soundManager.js';

export class ThreeBoard {
  constructor(containerEl, onTileClick = null, onTileHover = null) {
    this.container = containerEl;
    this.onTileClick = onTileClick;
    this.onTileHover = onTileHover;
    this.width = containerEl.clientWidth || 800;
    this.height = containerEl.clientHeight || 600;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.tileMeshes = [];
    this.playerTokens = [];
    this.houseMeshes = {}; // tileIndex -> array of meshes
    this.diceMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredTile = null;

    this.isAnimating = false;
    this.cameraMode = 'topDown';
    this.cameraTransition = true;
    this.targetCameraPos = new THREE.Vector3(0, 42, 0.01);
    this.targetControlsTarget = new THREE.Vector3(0, 0, 0);

    this.init();
  }

  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101a14);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 1000);
    this.camera.position.copy(this.targetCameraPos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r180+
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.08; // Prevent going underneath board
    this.controls.minDistance = 10;
    this.controls.maxDistance = 180;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => { this.cameraTransition = false; });
    this.setCameraPreset(this.cameraMode);
    this.camera.position.copy(this.targetCameraPos);

    // 5. Lighting
    this.setupLighting();

    // 6. Board geometry & tiles
    this.buildBoard();

    // 7. 3D Dice
    this.createDice();

    // 8. Event listeners
    this.setupEvents();

    // 9. Start render loop
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xf3e9d2, 0.65);
    this.scene.add(ambient);

    // Main warm overhead sun
    const mainLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    mainLight.position.set(12, 28, 16);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 70;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    mainLight.shadow.bias = -0.0005;
    this.scene.add(mainLight);

    // Warm brass rim light for metallic token reflections
    const rimLight = new THREE.DirectionalLight(0xd9b36c, 0.55);
    rimLight.position.set(-16, 18, -16);
    this.scene.add(rimLight);

    // Subtle table center point light
    const centerGlow = new THREE.PointLight(0xfef08a, 0.4, 30);
    centerGlow.position.set(0, 4, 0);
    this.scene.add(centerGlow);
  }

  buildBoard() {
    // Outer wooden border table base
    const tableGeom = new THREE.BoxGeometry(26.6, 1.2, 26.6);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x181410,
      roughness: 0.45,
      metalness: 0.1
    });
    const table = new THREE.Mesh(tableGeom, tableMat);
    table.position.y = -0.6;
    table.receiveShadow = true;
    this.scene.add(table);

    // Inner board felt center
    const feltGeom = new THREE.BoxGeometry(24.8, 0.2, 24.8);
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0xd8ebe4, // Authentic vintage Monopoly felt mint green
      roughness: 0.85,
      metalness: 0.05
    });
    const felt = new THREE.Mesh(feltGeom, feltMat);
    felt.position.y = 0.05;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // Center Monopoly Logo plate
    this.createBoardCenter();

    // 40 Perimeter Tiles
    this.createTiles();
  }

  createBoardCenter() {
    const centerCanvas = document.createElement('canvas');
    centerCanvas.width = 512;
    centerCanvas.height = 512;
    const ctx = centerCanvas.getContext('2d');

    // Background vintage mint
    ctx.fillStyle = '#d8ebe4';
    ctx.fillRect(0, 0, 512, 512);

    // Angled Red Monopoly banner
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(-Math.PI / 4);

    // Red pill container
    ctx.fillStyle = '#7a1a10';
    ctx.strokeStyle = '#f6efdd';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-210, -50, 420, 100, 20);
    ctx.fill();
    ctx.stroke();

    // Bold text
    ctx.fillStyle = '#f6efdd';
    ctx.font = 'bold 50px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillText('MONOPOLY AI', 0, 0);

    ctx.restore();

    // Subtitle & Chance / Community Chest outline boxes
    ctx.fillStyle = 'rgba(36, 29, 18, 0.75)';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('E X P E C T I M I N I M A X   G A M E   E N G I N E', 256, 385);

    // Card slots
    ctx.strokeStyle = 'rgba(76, 66, 49, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(60, 60, 130, 85);
    ctx.strokeRect(322, 367, 130, 85);
    ctx.setLineDash([]);

    ctx.fillStyle = '#b4622a';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('CHANCE', 125, 108);
    ctx.fillStyle = '#2d4a63';
    ctx.fillText('COMMUNITY CHEST', 387, 415);

    const texture = new THREE.CanvasTexture(centerCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const centerPlateGeom = new THREE.PlaneGeometry(16.5, 16.5);
    const centerPlateMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const centerPlate = new THREE.Mesh(centerPlateGeom, centerPlateMat);
    centerPlate.rotation.x = -Math.PI / 2;
    centerPlate.position.y = 0.16;
    centerPlate.receiveShadow = true;
    this.scene.add(centerPlate);
  }

  // Calculate world coordinates for tile index (0-39)
  getTileWorldPosition(tileIndex) {
    const coords = getTileGridCoords(tileIndex);
    // Grid: row 0..10, col 0..10
    // Center is (5, 5). Total board size is 23.4.
    // Tile step: corners are 2.7, regular 9 tiles are 2.0
    const step = 2.0;
    const cornerSize = 2.7;
    const offset = 10.35; // edge offset from center

    let x = 0;
    let z = 0;

    // Col mapping to X (-offset to +offset)
    if (coords.col === 0) x = -offset;
    else if (coords.col === 10) x = offset;
    else x = -offset + cornerSize / 2 + step * (coords.col - 0.5);

    // Row mapping to Z (-offset to +offset)
    if (coords.row === 0) z = -offset;
    else if (coords.row === 10) z = offset;
    else z = -offset + cornerSize / 2 + step * (coords.row - 0.5);

    return { x, y: 0.17, z, side: coords.side, isCorner: coords.row % 10 === 0 && coords.col % 10 === 0 };
  }

  createTiles() {
    this.tileMeshes = [];

    for (let i = 0; i < 40; i++) {
      const sq = BoardSquares[i];
      const pos = this.getTileWorldPosition(i);
      const isCorner = pos.isCorner;

      const tileW = isCorner ? 2.7 : (pos.side === 'top' || pos.side === 'bottom' ? 2.0 : 2.7);
      const tileH = isCorner ? 2.7 : (pos.side === 'top' || pos.side === 'bottom' ? 2.7 : 2.0);

      // Procedural canvas texture for tile face
      const texture = this.generateTileTexture(sq, pos.side, isCorner);
      const tileGeom = new THREE.BoxGeometry(tileW, 0.22, tileH);

      // White/cream tile material with texture on top face
      const faceMat = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false
      });
      const borderMat = new THREE.MeshStandardMaterial({
        color: 0xf3ecd9,
        roughness: 0.4
      });

      // Box materials: [right, left, top, bottom, front, back] -> top is index 2
      const materials = [borderMat, borderMat, faceMat, borderMat, borderMat, borderMat];
      const tileMesh = new THREE.Mesh(tileGeom, materials);
      tileMesh.position.set(pos.x, pos.y, pos.z);
      tileMesh.receiveShadow = true;
      tileMesh.userData = { tileIndex: i, square: sq };

      // Optional Ownership indicator ribbon (starts hidden)
      const ribbonGeom = new THREE.BoxGeometry(tileW * 0.95, 0.06, 0.16);
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        emissive: 0x000000,
        visible: false
      });
      const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
      ribbon.position.set(0, 0.12, pos.side === 'bottom' ? -tileH * 0.42 : tileH * 0.42);
      tileMesh.add(ribbon);
      tileMesh.userData.ownerRibbon = ribbon;

      this.scene.add(tileMesh);
      this.tileMeshes.push(tileMesh);
    }
  }

  generateTileTexture(sq, side, isCorner) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Base background
    ctx.fillStyle = '#f6efdd';
    ctx.fillRect(0, 0, 256, 340);

    // Thin inner border
    ctx.strokeStyle = '#d8cbaa';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 332);

    if (isCorner) {
      // Corner tiles (GO, Jail, Free Parking, Go to Jail)
      ctx.fillStyle = '#241d12';
      ctx.font = 'bold 30px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (sq.type === TileTypes.GO) {
        ctx.fillStyle = '#a03123';
        ctx.font = '900 56px Georgia, serif';
        ctx.fillText('GO', 128, 140);
        ctx.fillStyle = '#241d12';
        ctx.font = 'bold 19px Georgia, serif';
        ctx.fillText('COLLECT $200', 128, 220);
        ctx.fillText('AS YOU PASS', 128, 250);
      } else if (sq.type === TileTypes.JAIL) {
        ctx.fillStyle = '#b4622a';
        ctx.fillRect(50, 50, 156, 120);
        ctx.fillStyle = '#f6efdd';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.fillText('IN JAIL', 128, 110);
        ctx.fillStyle = '#241d12';
        ctx.font = 'bold 30px Georgia, serif';
        ctx.fillText('JUST VISITING', 128, 250);
      } else if (sq.type === TileTypes.FREE_PARKING) {
        ctx.fillStyle = '#2f5d43';
        ctx.font = '900 38px Georgia, serif';
        ctx.fillText('FREE', 128, 130);
        ctx.fillText('PARKING', 128, 180);
      } else if (sq.type === TileTypes.GO_TO_JAIL) {
        ctx.fillStyle = '#2d4a63';
        ctx.font = '900 36px Georgia, serif';
        ctx.fillText('GO TO', 128, 130);
        ctx.fillText('JAIL', 128, 180);
      }
    } else {
      // Regular street or special tile
      if (sq.type === TileTypes.PROPERTY) {
        // Color banner at top
        const group = ColorGroups[sq.group.toUpperCase()];
        ctx.fillStyle = group ? group.color : '#94a3b8';
        ctx.fillRect(6, 6, 244, 76);
        ctx.strokeStyle = '#241d12';
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, 244, 76);

        // Name
        ctx.fillStyle = '#241d12';
        ctx.font = 'bold 22px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Wrap name if needed
        const words = sq.name.split(' ');
        if (words.length > 2) {
          ctx.fillText(words.slice(0, 2).join(' '), 128, 110, 232);
          ctx.fillText(words.slice(2).join(' '), 128, 150, 232);
        } else if (words.length === 2) {
          ctx.fillText(words[0], 128, 110, 232);
          ctx.fillText(words[1], 128, 150, 232);
        } else {
          ctx.fillText(sq.name, 128, 125, 232);
        }

        // Price at bottom
        ctx.fillStyle = '#4c4231';
        ctx.font = '900 34px Georgia, serif';
        ctx.fillText(`$${sq.price}`, 128, 280);
      } else {
        // Railroads, Utilities, Tax, Chance, CC
        ctx.fillStyle = '#241d12';
        ctx.font = 'bold 24px Georgia, serif';
        ctx.textAlign = 'center';
        const words = sq.name.split(' ');
        ctx.fillText(words[0], 128, 46, 232);
        ctx.fillText(words.slice(1).join(' '), 128, 78, 232);

        if (sq.type === TileTypes.RAILROAD) {
          this.drawTileGlyph(ctx, 'railroad');
          ctx.font = 'bold 24px Georgia, serif';
          ctx.fillText(`$${sq.price}`, 128, 280);
        } else if (sq.type === TileTypes.UTILITY) {
          this.drawTileGlyph(ctx, sq.index === 12 ? 'electric' : 'water');
          ctx.font = 'bold 24px Georgia, serif';
          ctx.fillText(`$${sq.price}`, 128, 280);
        } else if (sq.type === TileTypes.CHANCE) {
          ctx.fillStyle = '#b4622a';
          ctx.font = '900 70px Georgia, serif';
          ctx.fillText('?', 128, 180);
        } else if (sq.type === TileTypes.COMMUNITY_CHEST) {
          this.drawTileGlyph(ctx, 'chest');
        } else if (sq.type === TileTypes.TAX) {
          this.drawTileGlyph(ctx, 'tax');
          ctx.fillStyle = '#a03123';
          ctx.font = 'bold 24px Georgia, serif';
          ctx.fillText(`Pay $${sq.taxAmount}`, 128, 260);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    if (side === 'left' || side === 'right') {
      texture.center.set(0.5, 0.5);
      texture.rotation = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    }
    return texture;
  }

  // Drawn ink glyphs for special 3D tiles (no emoji — drawn in the board's ink)
  drawTileGlyph(ctx, kind) {
    const ink = '#241d12';
    ctx.save();
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';

    if (kind === 'railroad') {
      // Locomotive silhouette
      ctx.strokeRect(64, 118, 96, 52);          // boiler
      ctx.fillRect(160, 96, 40, 74);            // cab
      ctx.fillRect(78, 92, 20, 26);             // chimney
      ctx.beginPath();
      ctx.moveTo(64, 170); ctx.lineTo(40, 170); ctx.lineTo(64, 148); // cow catcher
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(92, 182, 16, 0, Math.PI * 2); ctx.fill();  // wheels
      ctx.beginPath(); ctx.arc(136, 182, 16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(180, 182, 16, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'electric') {
      // Bulb
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(128, 140, 38, 0, Math.PI * 2); ctx.stroke();
      ctx.fillRect(114, 178, 28, 20);
      ctx.beginPath();
      ctx.moveTo(116, 172); ctx.lineTo(124, 150); ctx.lineTo(132, 162); ctx.lineTo(140, 148);
      ctx.stroke();
    } else if (kind === 'water') {
      // Droplet
      ctx.beginPath();
      ctx.moveTo(128, 92);
      ctx.bezierCurveTo(158, 136, 168, 152, 168, 168);
      ctx.arc(128, 168, 40, 0, Math.PI, false);
      ctx.bezierCurveTo(88, 152, 98, 136, 128, 92);
      ctx.fill();
    } else if (kind === 'chest') {
      // Treasure chest
      ctx.fillRect(72, 138, 112, 58);
      ctx.beginPath();
      ctx.moveTo(72, 138);
      ctx.bezierCurveTo(72, 108, 184, 108, 184, 138);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f6efdd';
      ctx.fillRect(122, 148, 12, 18);
    } else if (kind === 'tax') {
      // Coin with dollar mark
      ctx.beginPath(); ctx.arc(128, 152, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6efdd';
      ctx.font = '900 52px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 128, 154);
    }

    ctx.restore();
  }

  // Create 3D player tokens
  initPlayers(players) {
    // Remove existing tokens
    this.playerTokens.forEach(t => this.scene.remove(t.mesh));
    this.playerTokens = [];

    const tokenColors = [0xa9863f, 0xa03123, 0x2f5d43, 0x2d4a63];

    players.forEach((p, idx) => {
      const color = tokenColors[idx % tokenColors.length];
      const tokenMesh = this.createTokenMesh(idx, color);
      tokenMesh.castShadow = true;

      const pos = this.getTileWorldPosition(p.position);
      // Offset multiple tokens on same square so they don't clip
      const offsetAngle = (idx / players.length) * Math.PI * 2;
      const r = 0.55;
      tokenMesh.position.set(pos.x + Math.cos(offsetAngle) * r, 0.45, pos.z + Math.sin(offsetAngle) * r);

      this.scene.add(tokenMesh);
      this.playerTokens.push({
        id: p.id,
        mesh: tokenMesh,
        currentTile: p.position
      });
    });
  }

  createTokenMesh(typeIdx, colorHex) {
    const group = new THREE.Group();

    // Metallic luxury material
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.85,
      roughness: 0.25,
      envMapIntensity: 1.2
    });

    if (typeIdx === 0) {
      // Top Hat Token
      const brimGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24);
      const brim = new THREE.Mesh(brimGeom, mat);
      const crownGeom = new THREE.CylinderGeometry(0.36, 0.32, 0.65, 24);
      const crown = new THREE.Mesh(crownGeom, mat);
      crown.position.y = 0.35;
      group.add(brim, crown);
    } else if (typeIdx === 1) {
      // Sports Car / Roadster Token
      const bodyGeom = new THREE.BoxGeometry(0.9, 0.3, 0.45);
      const body = new THREE.Mesh(bodyGeom, mat);
      body.position.y = 0.15;
      const roofGeom = new THREE.BoxGeometry(0.45, 0.25, 0.38);
      const roof = new THREE.Mesh(roofGeom, mat);
      roof.position.set(-0.05, 0.38, 0);
      group.add(body, roof);
    } else if (typeIdx === 2) {
      // Battleship Token
      const hullGeom = new THREE.ConeGeometry(0.45, 1.1, 4);
      const hull = new THREE.Mesh(hullGeom, mat);
      hull.rotation.x = Math.PI / 2;
      hull.rotation.z = Math.PI / 4;
      hull.position.y = 0.2;
      group.add(hull);
    } else {
      // Classic Pawn / Thimble Token
      const baseGeom = new THREE.CylinderGeometry(0.42, 0.48, 0.2, 24);
      const base = new THREE.Mesh(baseGeom, mat);
      const waistGeom = new THREE.CylinderGeometry(0.22, 0.35, 0.45, 24);
      const waist = new THREE.Mesh(waistGeom, mat);
      waist.position.y = 0.3;
      const headGeom = new THREE.SphereGeometry(0.26, 24, 24);
      const head = new THREE.Mesh(headGeom, mat);
      head.position.y = 0.62;
      group.add(base, waist, head);
    }

    return group;
  }

  // Smooth multi-step hop animation from oldTile to newTile
  animateMovePlayer(playerId, oldTile, newTile, steps, onComplete = null) {
    const token = this.playerTokens.find(t => t.id === playerId);
    if (!token) {
      if (onComplete) onComplete();
      return;
    }

    this.isAnimating = true;
    let currentStep = 0;
    const totalSteps = steps > 0 ? steps : (newTile - oldTile + 40) % 40;

    const hopNext = () => {
      if (currentStep >= totalSteps) {
        token.currentTile = newTile;
        this.isAnimating = false;
        if (onComplete) onComplete();
        return;
      }

      currentStep++;
      const nextTileIndex = (oldTile + currentStep) % 40;
      const targetPos = this.getTileWorldPosition(nextTileIndex);

      const startX = token.mesh.position.x;
      const startZ = token.mesh.position.z;
      const endX = targetPos.x;
      const endZ = targetPos.z;

      // Play hop sound
      soundManager.playDiceRoll();

      // Quadratic parabolic hop curve
      const startTime = performance.now();
      const hopDuration = Math.max(120, 320 - totalSteps * 15); // Faster if many steps

      const stepAnimation = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(1, elapsed / hopDuration);

        // Ease in-out
        const t = progress;
        token.mesh.position.x = startX + (endX - startX) * t;
        token.mesh.position.z = startZ + (endZ - startZ) * t;
        token.mesh.position.y = 0.45 + Math.sin(t * Math.PI) * 0.85; // Arc height

        if (progress < 1) {
          requestAnimationFrame(stepAnimation);
        } else {
          token.mesh.position.y = 0.45;
          hopNext();
        }
      };

      requestAnimationFrame(stepAnimation);
    };

    hopNext();
  }

  // Update visual ownership ribbon on 3D tile
  updatePropertyOwnership(tileIndex, ownerColor) {
    const tile = this.tileMeshes[tileIndex];
    if (!tile || !tile.userData.ownerRibbon) return;

    const ribbon = tile.userData.ownerRibbon;
    if (ownerColor) {
      ribbon.material.visible = true;
      ribbon.material.color.set(ownerColor);
      ribbon.material.emissive.set(ownerColor);
      ribbon.material.emissiveIntensity = 0.3;
    } else {
      ribbon.material.visible = false;
    }
  }

  // Update 3D Houses / Hotels on tile
  updateBuilding(tileIndex, houses, hasHotel) {
    // Clear old houses on this tile
    if (this.houseMeshes[tileIndex]) {
      this.houseMeshes[tileIndex].forEach(m => this.scene.remove(m));
      delete this.houseMeshes[tileIndex];
    }

    if (houses === 0 && !hasHotel) return;

    const tilePos = this.getTileWorldPosition(tileIndex);
    const meshes = [];

    if (hasHotel) {
      // Big Red Hotel
      const hotelGeom = new THREE.BoxGeometry(0.7, 0.45, 0.5);
      const hotelMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.3,
        metalness: 0.1
      });
      const hotelMesh = new THREE.Mesh(hotelGeom, hotelMat);
      hotelMesh.castShadow = true;
      hotelMesh.position.set(tilePos.x, 0.45, tilePos.z);
      this.scene.add(hotelMesh);
      meshes.push(hotelMesh);
    } else {
      // 1 to 4 Small Green Houses
      const houseGeom = new THREE.BoxGeometry(0.3, 0.32, 0.3);
      const houseMat = new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        roughness: 0.35,
        metalness: 0.1
      });

      const spacing = 0.38;
      const startOffset = -((houses - 1) * spacing) / 2;

      for (let h = 0; h < houses; h++) {
        const houseMesh = new THREE.Mesh(houseGeom, houseMat);
        houseMesh.castShadow = true;

        if (tilePos.side === 'top' || tilePos.side === 'bottom') {
          houseMesh.position.set(tilePos.x + startOffset + h * spacing, 0.38, tilePos.z);
        } else {
          houseMesh.position.set(tilePos.x, 0.38, tilePos.z + startOffset + h * spacing);
        }

        this.scene.add(houseMesh);
        meshes.push(houseMesh);
      }
    }

    this.houseMeshes[tileIndex] = meshes;
  }

  // 3D Dice initialization & rolling animation
  createDice() {
    this.diceMeshes = [];
    for (let i = 0; i < 2; i++) {
      const geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      // Dice materials with pips
      const materials = this.generateDiceMaterials();
      const dieMesh = new THREE.Mesh(geom, materials);
      dieMesh.castShadow = true;
      dieMesh.position.set(-2 + i * 4, 0.65, 0);
      this.scene.add(dieMesh);
      this.diceMeshes.push(dieMesh);
    }
  }

  generateDiceMaterials() {
    // Canvas textures for 1 to 6 dots
    const pipCoords = {
      1: [[128, 128]],
      2: [[64, 64], [192, 192]],
      3: [[64, 64], [128, 128], [192, 192]],
      4: [[64, 64], [192, 64], [64, 192], [192, 192]],
      5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
      6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
    };

    const mats = [];
    // Box face order: +X (1), -X (6), +Y (2), -Y (5), +Z (3), -Z (4)
    const faceValues = [1, 6, 2, 5, 3, 4];

    faceValues.forEach(val => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Ivory die face
      ctx.fillStyle = '#f6efdd';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#d8cbaa';
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, 244, 244);

      // Pips (black dots)
      ctx.fillStyle = '#1c1917';
      pipCoords[val].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 26, 0, Math.PI * 2);
        ctx.fill();
      });

      const tex = new THREE.CanvasTexture(canvas);
      mats.push(new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.25,
        metalness: 0.1
      }));
    });

    return mats;
  }

  // Animate 3D tumbling dice roll
  roll3DDice(d1, d2, onComplete = null) {
    if (this.diceMeshes.length < 2) return;

    soundManager.playDiceRoll();

    const startTime = performance.now();
    const duration = 750; // ms

    // Target rotations to show d1 and d2 on top face (+Y is index 2 -> value 2)
    const faceRotations = {
      1: { x: 0, z: Math.PI / 2 },
      2: { x: 0, z: 0 },
      3: { x: -Math.PI / 2, z: 0 },
      4: { x: Math.PI / 2, z: 0 },
      5: { x: Math.PI, z: 0 },
      6: { x: 0, z: -Math.PI / 2 }
    };

    const die1Target = faceRotations[d1] || { x: 0, z: 0 };
    const die2Target = faceRotations[d2] || { x: 0, z: 0 };

    const animateRoll = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        // Tumbling spin
        const height = Math.sin(progress * Math.PI) * 4.5;
        this.diceMeshes[0].position.set(-2.5 + Math.sin(progress * 10) * 1.5, 0.65 + height, 0 + Math.cos(progress * 12) * 1.5);
        this.diceMeshes[0].rotation.x += 0.45;
        this.diceMeshes[0].rotation.y += 0.35;

        this.diceMeshes[1].position.set(2.5 + Math.cos(progress * 10) * 1.5, 0.65 + height, 0 + Math.sin(progress * 12) * 1.5);
        this.diceMeshes[1].rotation.x -= 0.4;
        this.diceMeshes[1].rotation.z += 0.5;

        requestAnimationFrame(animateRoll);
      } else {
        // Settle flat on top face values
        this.diceMeshes[0].position.set(-2.2, 0.65, 0);
        this.diceMeshes[0].rotation.set(die1Target.x, 0, die1Target.z);

        this.diceMeshes[1].position.set(2.2, 0.65, 0);
        this.diceMeshes[1].rotation.set(die2Target.x, 0, die2Target.z);

        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateRoll);
  }

  // Camera presets
  setCameraPreset(mode) {
    this.cameraMode = mode;
    this.cameraTransition = true;
    if (mode === 'isometric' || mode === 'topDown') {
      const direction = new THREE.Vector3(0, 1, mode === 'topDown' ? 0.0001 : 0.65).normalize();
      const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const tanH = tanV * this.camera.aspect;
      let distance = 0;
      // Fit every board corner in both axes, including portrait containers.
      for (const x of [-13.4, 13.4]) for (const y of [-1.2, 1]) for (const z of [-13.4, 13.4]) {
        const corner = new THREE.Vector3(x, y, z);
        distance = Math.max(distance, corner.dot(direction) + Math.abs(corner.dot(right)) / tanH, corner.dot(direction) + Math.abs(corner.dot(up)) / tanV);
      }
      this.targetCameraPos.copy(direction.multiplyScalar(distance * 1.03));
      this.targetControlsTarget.set(0, 0, 0);
    } else if (mode === 'follow' && this.playerTokens.length > 0) {
      // Zoom into active player
      const activeToken = this.playerTokens[0];
      this.targetCameraPos.set(activeToken.mesh.position.x * 0.7, 16, activeToken.mesh.position.z + 18);
      this.targetControlsTarget.set(activeToken.mesh.position.x, 0, activeToken.mesh.position.z);
    }
  }

  zoomBy(factor) {
    this.cameraTransition = false;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
  }

  setupEvents() {
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    let pointerStart = null;
    this.renderer.domElement.addEventListener('pointerdown', e => { pointerStart = { x: e.clientX, y: e.clientY }; });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.checkHover();
    });

    this.renderer.domElement.addEventListener('click', (e) => {
      if (pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.checkHover();
      if (this.hoveredTile && this.onTileClick) {
        this.onTileClick(this.hoveredTile.userData.tileIndex);
      }
    });
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tileMeshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      if (this.hoveredTile !== mesh) {
        if (this.hoveredTile) {
          this.hoveredTile.position.y = 0.17;
        }
        this.hoveredTile = mesh;
        this.hoveredTile.position.y = 0.32; // subtle hover lift
        this.container.style.cursor = 'pointer';
        this.onTileHover?.(mesh.userData.tileIndex);
      }
    } else if (this.hoveredTile) {
      this.hoveredTile.position.y = 0.17;
      this.hoveredTile = null;
      this.container.style.cursor = 'default';
      this.onTileHover?.(null);
    }
  }

  onResize() {
    if (!this.container.clientWidth || !this.container.clientHeight) return;
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.setCameraPreset(this.cameraMode);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Smooth camera transition toward target
    if (this.cameraTransition) {
      this.camera.position.lerp(this.targetCameraPos, 0.12);
      this.controls.target.lerp(this.targetControlsTarget, 0.12);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.01) this.cameraTransition = false;
    }
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  }
}
