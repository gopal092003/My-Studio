import * as THREE from "three";

function seededNoise(x: number, y: number, seed = 37) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Procedural, tileable-looking stone maps keep the scene self-contained. */
export function createMarbleMaps() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const colorContext = colorCanvas.getContext("2d");
  const bumpContext = bumpCanvas.getContext("2d");
  if (!colorContext || !bumpContext) return null;

  const colorPixels = colorContext.createImageData(size, size);
  const bumpPixels = bumpContext.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const index = (y * size + x) * 4;
      const warp = v * 8 + Math.sin(u * 11 + Math.sin(v * 12) * 0.7) * 0.32 + Math.sin((u + v) * 31) * 0.035;
      const vein = 1 - smoothstep(0.015, 0.105, Math.abs(Math.sin(warp * Math.PI)));
      const grain = (seededNoise(x, y) - 0.5) * 7;
      const cloud = Math.sin(u * 28 + Math.sin(v * 19) * 1.2) * 2.5 + Math.sin(v * 36 + u * 14) * 1.7;
      const shade = grain + cloud - vein * (13 + seededNoise(x >> 2, y >> 2, 8) * 17);
      colorPixels.data[index] = Math.max(0, Math.min(255, 219 + shade));
      colorPixels.data[index + 1] = Math.max(0, Math.min(255, 214 + shade));
      colorPixels.data[index + 2] = Math.max(0, Math.min(255, 202 + shade));
      colorPixels.data[index + 3] = 255;

      const relief = 132 + grain * 1.6 + cloud * 1.8 - vein * 18;
      bumpPixels.data[index] = relief;
      bumpPixels.data[index + 1] = relief;
      bumpPixels.data[index + 2] = relief;
      bumpPixels.data[index + 3] = 255;
    }
  }
  colorContext.putImageData(colorPixels, 0, 0);
  bumpContext.putImageData(bumpPixels, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 8;
  return { map, bumpMap };
}

export function createMuseumFloorTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const columns = 12;
  const rows = 16;
  const tileWidth = size / columns;
  const tileHeight = size / rows;
  const colors = ["#c8c0b2", "#d7cebf", "#c3bbad", "#ded5c7", "#cec6b8"];
  ctx.fillStyle = "#786f63";
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const color = colors[Math.floor(seededNoise(column, row, 9) * colors.length)];
      const x = column * tileWidth;
      const y = row * tileHeight;
      const stone = ctx.createLinearGradient(x, y, x + tileWidth, y + tileHeight);
      stone.addColorStop(0, "#e1d8c9");
      stone.addColorStop(0.28, color);
      stone.addColorStop(0.72, "#d0c8ba");
      stone.addColorStop(1, "#bfb7aa");
      ctx.fillStyle = stone;
      ctx.fillRect(x + 2, y + 2, tileWidth - 4, tileHeight - 4);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 3, y + 3, tileWidth - 6, tileHeight - 6);
      ctx.clip();
      for (let vein = 0; vein < 4; vein++) {
        const offset = seededNoise(column, row, vein + 11);
        ctx.beginPath();
        ctx.moveTo(x - 8, y + tileHeight * offset);
        ctx.bezierCurveTo(
          x + tileWidth * 0.32, y + tileHeight * (offset + 0.12),
          x + tileWidth * 0.63, y + tileHeight * (offset - 0.1),
          x + tileWidth + 8, y + tileHeight * (offset + 0.03),
        );
        ctx.strokeStyle = vein % 2 === 0 ? "rgba(104, 96, 83, 0.11)" : "rgba(255, 250, 239, 0.25)";
        ctx.lineWidth = vein % 2 === 0 ? 1.2 : 2.2;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(248, 241, 229, 0.48)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + tileWidth - 3, y + 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  const traceMedallion = (centerX: number, centerY: number, scale: number, phase = 0) => {
    ctx.beginPath();
    for (let index = 0; index <= 240; index++) {
      const angle = (index / 240) * Math.PI * 2;
      const scallop = 1 + 0.13 * Math.cos(angle * 4 + phase) + 0.035 * Math.cos(angle * 8 - phase);
      const x = centerX + Math.cos(angle) * 425 * scale * scallop;
      const y = centerY + Math.sin(angle) * 178 * scale * scallop;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Broad dark stone and bronze quatrefoils echo the flowing inlay in the reference hall.
  for (let index = -1; index <= 3; index++) {
    const centerX = size / 2 + (index % 2 === 0 ? -18 : 18);
    const centerY = index * 365 + 182;
    const phase = index % 2 === 0 ? 0 : Math.PI / 4;
    traceMedallion(centerX, centerY, 1, phase);
    const darkStone = ctx.createLinearGradient(centerX - 410, centerY - 160, centerX + 410, centerY + 165);
    darkStone.addColorStop(0, "#35342f");
    darkStone.addColorStop(0.28, "#242521");
    darkStone.addColorStop(0.58, "#403b31");
    darkStone.addColorStop(1, "#282925");
    ctx.fillStyle = darkStone;
    ctx.fill();
    ctx.strokeStyle = "rgba(35, 31, 26, 0.7)";
    ctx.lineWidth = 5;
    ctx.stroke();

    traceMedallion(centerX, centerY, 0.79, phase);
    const bronzeStone = ctx.createLinearGradient(centerX - 320, centerY - 120, centerX + 310, centerY + 125);
    bronzeStone.addColorStop(0, "#b79a6c");
    bronzeStone.addColorStop(0.5, "#8f7754");
    bronzeStone.addColorStop(1, "#c4a879");
    ctx.fillStyle = bronzeStone;
    ctx.fill();

    traceMedallion(centerX, centerY, 0.68, phase);
    const insetStone = ctx.createRadialGradient(centerX - 80, centerY - 70, 20, centerX, centerY, 310);
    insetStone.addColorStop(0, "#49463c");
    insetStone.addColorStop(0.58, "#292a26");
    insetStone.addColorStop(1, "#38352e");
    ctx.fillStyle = insetStone;
    ctx.fill();

    // Restrained bronze scrolls catch the light inside each dark stone panel.
    ctx.save();
    traceMedallion(centerX, centerY, 0.65, phase);
    ctx.clip();
    ctx.translate(centerX, centerY);
    ctx.rotate(phase * 0.2);
    ctx.strokeStyle = "rgba(177, 145, 95, 0.72)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    for (let petal = 0; petal < 4; petal++) {
      ctx.save();
      ctx.rotate((petal / 4) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-42, -24, -76, -60, -18, -112);
      ctx.bezierCurveTo(8, -137, 49, -117, 31, -86);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // A soft satin reflection keeps the dark stone rich without making it look lacquered.
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, "rgba(255, 251, 240, .08)");
  sheen.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(1, "rgba(31, 27, 22, .13)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  const pixels = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const grain = (seededNoise(x, y, 71) - 0.5) * 5;
      pixels.data[index] = Math.max(0, Math.min(255, pixels.data[index] + grain));
      pixels.data[index + 1] = Math.max(0, Math.min(255, pixels.data[index + 1] + grain));
      pixels.data[index + 2] = Math.max(0, Math.min(255, pixels.data[index + 2] + grain));
    }
  }
  ctx.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createGlazingTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const clouds = Math.max(0, Math.sin(x * 0.014 + Math.sin(y * 0.016) * 1.7) * 0.55 + Math.sin(y * 0.021 - x * 0.006) * 0.35);
      const grain = (seededNoise(x, y, 53) - 0.5) * 4;
      image.data[index] = 174 + clouds * 23 + grain;
      image.data[index + 1] = 205 + clouds * 24 + grain;
      image.data[index + 2] = 205 + clouds * 22 + grain;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const glow = ctx.createLinearGradient(0, 0, size * 0.8, size);
  glow.addColorStop(0, "rgba(255, 255, 255, .19)");
  glow.addColorStop(0.48, "rgba(255, 255, 255, 0)");
  glow.addColorStop(1, "rgba(58, 103, 106, .13)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Soft, self-contained archviz reflections for polished stone and metal surfaces. */
export function createMuseumEnvironmentTexture() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#7d9ca3");
  sky.addColorStop(0.28, "#b9c8c6");
  sky.addColorStop(0.48, "#e8e2d2");
  sky.addColorStop(0.55, "#938776");
  sky.addColorStop(1, "#292b29");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Repeated skylight bays create broad, restrained highlights in the PBR reflections.
  for (let index = 0; index < 8; index++) {
    const x = index * 128 + 14;
    const glazing = ctx.createLinearGradient(0, 38, 0, 238);
    glazing.addColorStop(0, "rgba(238, 246, 239, .9)");
    glazing.addColorStop(0.45, "rgba(212, 229, 222, .58)");
    glazing.addColorStop(1, "rgba(151, 184, 181, .12)");
    ctx.fillStyle = glazing;
    ctx.fillRect(x, 38, 99, 202);
    ctx.fillStyle = "rgba(65, 83, 79, .5)";
    ctx.fillRect(x, 36, 5, 206);
    ctx.fillRect(x + 48, 38, 2, 202);
    ctx.fillRect(x + 96, 36, 5, 206);
    ctx.fillRect(x, 118, 99, 3);
    ctx.fillRect(x, 194, 99, 2);
  }

  const warmInterior = ctx.createLinearGradient(0, 245, 0, 410);
  warmInterior.addColorStop(0, "rgba(241, 207, 149, .18)");
  warmInterior.addColorStop(0.38, "rgba(183, 144, 91, .12)");
  warmInterior.addColorStop(1, "rgba(26, 28, 27, .3)");
  ctx.fillStyle = warmInterior;
  ctx.fillRect(0, 245, width, 170);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createWalnutMaps() {
  const width = 512;
  const height = 256;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = width;
  colorCanvas.height = bumpCanvas.height = height;
  const colorContext = colorCanvas.getContext("2d");
  const bumpContext = bumpCanvas.getContext("2d");
  if (!colorContext || !bumpContext) return null;

  const wood = colorContext.createLinearGradient(0, 0, width, height);
  wood.addColorStop(0, "#594538");
  wood.addColorStop(0.28, "#745d47");
  wood.addColorStop(0.62, "#4d3c31");
  wood.addColorStop(1, "#654d3a");
  colorContext.fillStyle = wood;
  colorContext.fillRect(0, 0, width, height);

  const slats = 18;
  const slatWidth = width / slats;
  for (let slat = 0; slat < slats; slat++) {
    const x = slat * slatWidth;
    const warmth = seededNoise(slat, 4, 23) * 16;
    colorContext.fillStyle = `rgba(${88 + warmth}, ${67 + warmth * 0.72}, ${48 + warmth * 0.45}, .38)`;
    colorContext.fillRect(x + 1, 0, slatWidth - 2, height);
    colorContext.fillStyle = "rgba(18, 15, 12, .27)";
    colorContext.fillRect(x, 0, 1.6, height);
    colorContext.fillStyle = "rgba(228, 197, 150, .09)";
    colorContext.fillRect(x + slatWidth - 3, 0, 1, height);
  }

  for (let line = 0; line < 72; line++) {
    const y = seededNoise(line, 7, 41) * height;
    const offset = seededNoise(line, 3, 19) * 18;
    colorContext.beginPath();
    colorContext.moveTo(0, y);
    colorContext.bezierCurveTo(width * 0.28, y + offset, width * 0.7, y - offset * 0.6, width, y + offset * 0.15);
    colorContext.strokeStyle = line % 4 === 0 ? "rgba(22, 16, 12, .21)" : "rgba(218, 183, 136, .07)";
    colorContext.lineWidth = line % 4 === 0 ? 1.2 : 0.7;
    colorContext.stroke();
  }

  const bump = bumpContext.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const slatGroove = x % slatWidth < 2 ? -22 : 0;
      const grain = (seededNoise(x, y, 101) - 0.5) * 13;
      const relief = 132 + slatGroove + grain;
      bump.data[index] = relief;
      bump.data[index + 1] = relief;
      bump.data[index + 2] = relief;
      bump.data[index + 3] = 255;
    }
  }
  bumpContext.putImageData(bump, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 4;
  return { map, bumpMap };
}

export function createSignTexture(options: { eyebrow: string; title: string; subtitle?: string; large?: boolean }) {
  const canvas = document.createElement("canvas");
  canvas.width = options.large ? 1536 : 1024;
  canvas.height = options.large ? 900 : 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const w = canvas.width;
  const h = canvas.height;
  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, "#162427");
  background.addColorStop(0.55, "#202d2d");
  background.addColorStop(1, "#111b1e");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.26, 8, w * 0.5, h * 0.26, h * 0.8);
  glow.addColorStop(0, "rgba(197, 164, 105, 0.15)");
  glow.addColorStop(1, "rgba(197, 164, 105, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(207, 177, 124, 0.7)";
  ctx.lineWidth = options.large ? 5 : 3;
  ctx.strokeRect(w * 0.035, h * 0.08, w * 0.93, h * 0.84);
  ctx.strokeStyle = "rgba(207, 177, 124, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(w * 0.05, h * 0.13, w * 0.9, h * 0.74);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d4b47b";
  ctx.font = `500 ${options.large ? 29 : 22}px Arial, sans-serif`;
  ctx.letterSpacing = options.large ? "8px" : "4px";
  ctx.fillText(options.eyebrow.toUpperCase(), w / 2, h * (options.large ? 0.24 : 0.26));

  ctx.fillStyle = "#f1eadc";
  ctx.font = `400 ${options.large ? 82 : 42}px Georgia, serif`;
  ctx.letterSpacing = options.large ? "1px" : "0px";
  ctx.fillText(options.title, w / 2, h * (options.large ? 0.46 : 0.56), w * 0.82);

  if (options.subtitle) {
    ctx.fillStyle = "#c6ccc3";
    ctx.font = `400 ${options.large ? 26 : 19}px Arial, sans-serif`;
    ctx.letterSpacing = options.large ? "1px" : "0px";
    ctx.fillText(options.subtitle, w / 2, h * 0.68, w * 0.84);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
