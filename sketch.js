// ---------- UI ----------
let pane;
let needsRedraw = true;
let deleteMode = false;
const PARAMS = {
	rectWidth: 150,
	rectHeight: 150,
	stripeMin: 1,
	stripeMax: 30,
	stripeRotate: 0,
	blur: 8,
	bwMin: 0,
	bwMax: 255,
	seed: 81,
	divLen: 30,
	sc: 0.5,
	showBG: true,
	bgColor: '#ffffff',
	color0: '#ffffff',
	color1: '#aaaaaa',
	color2: '#037fba',
	color3: '#b9da98',
	color4: '#ffffff',
};

const STORAGE_KEY = 'tile-painter-params';

function loadParams() {
	try {
		let saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (!saved) return;
		for (let key of Object.keys(PARAMS)) {
			if (typeof saved[key] === typeof PARAMS[key]) {
				PARAMS[key] = saved[key];
			}
		}
	} catch (e) {}
}

function saveParams() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(PARAMS));
	} catch (e) {}
}

// ---------- Parameters ----------
let rectWidth = -1;
let rectHeight = -1;
let stripeMin = -1;
let stripeMax = -1;
let blur = -1;
let bwMin = -1;
let bwMax = -1;
let seed = -1;
let stripeRotate = -1;
let divLen = -1;
let sc = -1;
let showBG = -1;
let bgColor = '#ffffff';
 
// ---------- State ----------
let blenders = [];
 
let colors = [
	"#ffffff",
	"#aaaaaa",
	"#037fba",
	"#b9da98",
	"#FFFFFF",
];
 
// ---------- p5 lifecycle ----------
function setup() {
	let cnv = createCanvas(...getCanvasSize());
	cnv.parent('sketch-holder');
	background(255);
	pixelDensity(1);
 
	setupUIs();
	createNewBlender();
}
 
function draw() {
	updateUIs();
}
 
function getCanvasSize() {
	let h = floor(windowHeight * 0.9);
	let w = floor(h * 1080 / 1440);
	return [w, h];
}

function windowResized() {
	let oldW = width;
	let oldH = height;
	let [w, h] = getCanvasSize();
	resizeCanvas(w, h);
	pixelDensity(1);

	for (let b of blenders) {
		for (let p of b.points) {
			p.x *= w / oldW;
			p.y *= h / oldH;
		}
	}
	drawAll(false);
}

let dragging = false;

function isInCanvas() {
	return mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
}

function placeTile() {
	let blender = blenders[blenders.length - 1];
	blender.addPoint(createVector(mouseX, mouseY));
	drawAll(false);
}

function mousePressed(e) {
	dragging = false;
	if (e && e.target && e.target.tagName !== 'CANVAS') return;
	if (deleteMode || !isInCanvas()) return;
	dragging = true;
	placeTile();
}

function mouseDragged() {
	if (!dragging || !isInCanvas()) return;
	let pts = blenders[blenders.length - 1].points;
	let last = pts[pts.length - 1];
	if (last && dist(last.x, last.y, mouseX, mouseY) < divLen) return;
	placeTile();
}

function mouseReleased(e) {
	dragging = false;
	if (!deleteMode) return;
	if (e && e.target && e.target.tagName !== 'CANVAS') return;
	if (isInCanvas()) deleteTileAt(mouseX, mouseY);
}
 
// ---------- UI setup / update ----------
function setupUIs() {
	loadParams();
	pane = new Tweakpane.Pane({ title: 'TILING BRUSH TOOL', container: document.getElementById('pane-holder') });

	const tile = pane.addFolder({ title: 'Tile' });
	tile.addBinding(PARAMS, 'rectWidth', { label: 'tile w', min: 1, max: 300, step: 1 });
	tile.addBinding(PARAMS, 'rectHeight', { label: 'tile h', min: 1, max: 300, step: 1 });
	tile.addBinding(PARAMS, 'stripeMin', { label: 'line min', min: 1, max: 100, step: 1 });
	tile.addBinding(PARAMS, 'stripeMax', { label: 'line max', min: 1, max: 100, step: 1 });
	tile.addBinding(PARAMS, 'stripeRotate', { label: 'rotate', min: 0, max: 360, step: 1 });
	tile.addBinding(PARAMS, 'blur', { min: 0, max: 30, step: 1 });
	tile.addBinding(PARAMS, 'bwMin', { label: 'bw min', min: 0, max: 255, step: 1 });
	tile.addBinding(PARAMS, 'bwMax', { label: 'bw max', min: 0, max: 255, step: 1 });
	tile.addBinding(PARAMS, 'seed', { min: 0, max: 100, step: 1 });
	tile.addBinding(PARAMS, 'divLen', { label: 'tile step', min: 1, max: 100, step: 1 });

	const dither = pane.addFolder({ title: 'Dither' });
	dither.addBinding(PARAMS, 'sc', { label: 'resolution', min: 0.01, max: 0.5, step: 0.01 });
	dither.addBinding(PARAMS, 'showBG', { label: 'dithering' });

	const palette = pane.addFolder({ title: 'Palette' });
	palette.addBinding(PARAMS, 'bgColor', { label: 'bg' });
	for (let i = 0; i < 5; i++) {
		palette.addBinding(PARAMS, 'color' + i, { label: 'color ' + (i + 1) });
	}

	pane.addButton({ title: 'Another Tile' }).on('click', createNewBlender);
	const deleteButton = pane.addButton({ title: 'Delete Mode: OFF' });
	deleteButton.on('click', () => {
		deleteMode = !deleteMode;
		deleteButton.title = 'Delete Mode: ' + (deleteMode ? 'ON' : 'OFF');
		cursor(deleteMode ? CROSS : ARROW);
	});
	pane.addButton({ title: 'Clear Canvas' }).on('click', clearBlender);
	pane.addButton({ title: 'Save Tiles' }).on('click', exportProject);
	pane.addButton({ title: 'Load Tiles' }).on('click', importProject);
	pane.addButton({ title: 'Export SVG' }).on('click', exportSVG);
	pane.addButton({ title: 'Export PNG' }).on('click', exportPNG);

	pane.on('change', () => {
		needsRedraw = true;
		saveParams();
	});
}

function exportSVG() {
	if (showBG != 1 || !blenders.some(b => b.ditherIdx)) {
		alert('SVG書き出しは "bg / pattern switch" をONにした状態で使えます');
		return;
	}

	let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" shape-rendering="crispEdges">\n';
	for (let b of blenders) {
		if (!b.ditherIdx) continue;
		let size = 1 / b.sc;
		let groups = colors.map(() => "");
		for (let n = 0; n < b.dh; n++) {
			for (let i = 0; i < b.dw; i++) {
				let c = b.ditherIdx[i + n * b.dw];
				if (c == NO_DITHER) continue;
				groups[c] += '<rect x="' + (i * size) + '" y="' + (n * size) + '" width="' + size + '" height="' + size + '"/>\n';
			}
		}
		for (let c = 0; c < colors.length; c++) {
			if (groups[c] != "") {
				svg += '<g fill="' + colors[c] + '">\n' + groups[c] + '</g>\n';
			}
		}
	}
	svg += '</svg>';

	let blob = new Blob([svg], { type: 'image/svg+xml' });
	let url = URL.createObjectURL(blob);
	let a = document.createElement('a');
	a.href = url;
	a.download = 'tile-painter.svg';
	a.click();
	URL.revokeObjectURL(url);
}
 
function exportProject() {
	let project = {
		version: 1,
		params: PARAMS,
		canvas: { width, height },
		blenders: blenders.map(b => ({
			tile: b.tile,
			divLen: b.divLen,
			sc: b.sc,
			points: b.points.map(p => [p.x, p.y]),
		})),
	};
	let blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
	let url = URL.createObjectURL(blob);
	let a = document.createElement('a');
	a.href = url;
	a.download = 'tile-painter-project.json';
	a.click();
	URL.revokeObjectURL(url);
}

function importProject() {
	let input = document.createElement('input');
	input.type = 'file';
	input.accept = 'application/json,.json';
	input.onchange = () => {
		let file = input.files[0];
		if (!file) return;
		file.text().then(text => {
			applyProject(JSON.parse(text));
		}).catch(() => alert('ファイルを読み込めませんでした'));
	};
	input.click();
}

function applyProject(project) {
	for (let key of Object.keys(PARAMS)) {
		if (typeof project.params[key] === typeof PARAMS[key]) {
			PARAMS[key] = project.params[key];
		}
	}

	let kx = width / project.canvas.width;
	let ky = height / project.canvas.height;
	for (let b of blenders) b.dispose();
	blenders = [];
	for (let sb of project.blenders) {
		let b = new Blender();
		b.buildTile(sb.tile);
		b.divLen = sb.divLen;
		b.sc = sb.sc;
		b.points = sb.points.map(p => createVector(p[0] * kx, p[1] * ky));
		blenders.push(b);
	}
	if (blenders.length == 0) createNewBlender();

	pane.refresh();
	saveParams();
	needsRedraw = true;
}

function exportPNG() {
	let pg = createGraphics(width, height);
	pg.pixelDensity(1);
	pg.clear();
	let dithered = showBG == 1;
	pg.drawingContext.imageSmoothingEnabled = !dithered;
	for (let b of blenders) {
		if (dithered) {
			if (b.ditherImg) pg.image(b.ditherImg, 0, 0, b.dw / b.sc, b.dh / b.sc);
		} else if (b.bgPG) {
			pg.image(b.bgPG, 0, 0);
		}
	}
	pg.canvas.toBlob(blob => {
		let url = URL.createObjectURL(blob);
		let a = document.createElement('a');
		a.href = url;
		a.download = 'tile-painter.png';
		a.click();
		URL.revokeObjectURL(url);
		pg.remove();
	}, 'image/png');
}

function updateUIs() {
	if (!needsRedraw) return;
	needsRedraw = false;

	rectWidth = PARAMS.rectWidth;
	rectHeight = PARAMS.rectHeight;
	stripeMin = PARAMS.stripeMin;
	stripeMax = PARAMS.stripeMax;
	stripeRotate = PARAMS.stripeRotate;
	blur = PARAMS.blur;
	bwMin = PARAMS.bwMin;
	bwMax = PARAMS.bwMax;
	seed = PARAMS.seed;
	divLen = PARAMS.divLen;
	sc = PARAMS.sc;
	showBG = PARAMS.showBG ? 1 : 0;
	bgColor = PARAMS.bgColor;
	colors = [PARAMS.color0, PARAMS.color1, PARAMS.color2, PARAMS.color3, PARAMS.color4];

	drawAll();
}

// ---------- Drawing ----------
function drawAll(rebuildTile = true) {
	let active = blenders[blenders.length - 1];
	if (rebuildTile || !active.pg) {
		active.buildTile();
	}
	active.divLen = divLen;
	active.sc = sc;

	background(bgColor);
	for (let i = 0; i < blenders.length; i++) {
		blenders[i].draw();
		image(blenders[i].bgPG, 0, 0);
	}

	if (showBG == 1) {
		updateDithering();
	}
}

function deleteTileAt(x, y) {
	for (let i = blenders.length - 1; i >= 0; i--) {
		let b = blenders[i];
		if (!b.bgPG) continue;
		let alpha = b.bgPG.drawingContext.getImageData(floor(x), floor(y), 1, 1).data[3];
		if (alpha > 0) {
			b.dispose();
			blenders.splice(i, 1);
			if (i == blenders.length) {
				createNewBlender();
			}
			drawAll(false);
			return;
		}
	}
}

function clearBlender() {
	for (let b of blenders) {
		b.dispose();
	}
	blenders = [];
	createNewBlender();
	drawAll();
}

function createNewBlender() {
	blenders.push(new Blender());
}

function currentTileParams() {
	return { rectWidth, rectHeight, stripeMin, stripeMax, stripeRotate, blur, bwMin, bwMax, seed };
}

// ---------- Blender ----------
class Blender {
	constructor() {
		this.points = [];
		this.tile = null;
		this.divLen = divLen;
		this.sc = sc;
		this.pg = null;
		this.bgPG = null;
		this.dPG = null;
		this.ditherIdx = null;
		this.ditherImg = null;
	}

	addPoint(vec) {
		this.points.push(vec);
	}

	dispose() {
		if (this.pg) this.pg.remove();
		if (this.bgPG) this.bgPG.remove();
		if (this.dPG) this.dPG.remove();
	}

	buildTile(t = currentTileParams()) {
		this.tile = t;
		let pg = this.pg;
		if (!pg || pg.width != t.rectWidth || pg.height != t.rectHeight) {
			if (pg) pg.remove();
			pg = createGraphics(t.rectWidth, t.rectHeight);
			pg.pixelDensity(1);
		}
		pg.background(255);
		pg.noStroke();

		randomSeed(t.seed);
		let h = 0.0;

		pg.push();
		pg.translate(pg.width * 0.5, pg.height * 0.5);
		pg.rotate(radians(t.stripeRotate));
		let maxSize = max(pg.width, pg.height);
		while (h <= maxSize * 2) {
			let xstep = floor(random(t.stripeMin, t.stripeMax));
			let col = random(t.bwMin, t.bwMax);
			pg.fill(col);
			pg.rect(h - maxSize, -maxSize, h + xstep, maxSize * 2);

			h += xstep;
		}
		pg.pop();
		pg.filter(BLUR, t.blur, false);

		this.pg = pg;
	}

	dither() {
		if (this.points.length == 0) {
			this.ditherIdx = null;
			this.ditherImg = null;
			return;
		}
		let dw = floor(width * this.sc);
		let dh = floor(height * this.sc);
		this.dw = dw;
		this.dh = dh;
		if (!this.dPG || this.dPG.width != dw || this.dPG.height != dh) {
			if (this.dPG) this.dPG.remove();
			this.dPG = createGraphics(dw, dh);
			this.dPG.pixelDensity(1);
		}
		let dPG = this.dPG;
		dPG.clear();
		dPG.image(this.bgPG, 0, 0, dw, dh);

		dPG.loadPixels();
		let px = dPG.pixels;
		let total = dw * dh;
		let nc = colors.length;
		if (!this.ditherIdx || this.ditherIdx.length != total) {
			this.ditherIdx = new Uint8Array(total);
		}
		let idx = this.ditherIdx;

		for (let j = 0; j < total; j++) {
			let o = j * 4;
			let a = px[o + 3];
			if (a >= 128) {
				if (a < 255) {
					let w = 255 * (255 - a) / 255;
					px[o] = px[o] * a / 255 + w;
					px[o + 1] = px[o + 1] * a / 255 + w;
					px[o + 2] = px[o + 2] * a / 255 + w;
				}
				idx[j] = 0;
			} else {
				idx[j] = NO_DITHER;
			}
			px[o + 3] = 255;
		}

		const at = (x, y) => Math.min(x + y * dw, total - 1) * 4;
		const diffuse = (x, y, err) => {
			let o = at(x, y);
			let v = err * 255;
			px[o] += v;
			px[o + 1] += v;
			px[o + 2] += v;
			px[o + 3] = 255;
		};

		for (let n = 0; n < dh; n++) {
			for (let i = 0; i < dw; i++) {
				if (idx[i + n * dw] == NO_DITHER) continue;
				let o = at(i, n);
				let bri = Math.max(px[o], px[o + 1], px[o + 2]) / 255.0;

				let k = Math.min(Math.floor(bri * nc), nc - 1);
				let newval = k / (nc - 1);
				let error = bri - newval;

				idx[i + n * dw] = k;
				let v = newval * 255;
				px[o] = v;
				px[o + 1] = v;
				px[o + 2] = v;
				px[o + 3] = 255;

				diffuse(i + 1, n, error * 7.0 / 16.0);
				diffuse(i - 1, n + 1, error * 3.0 / 16.0);
				diffuse(i, n + 1, error * 5.0 / 16.0);
				diffuse(i + 1, n + 1, error * 1.0 / 16.0);
			}
		}

		if (!this.ditherImg || this.ditherImg.width != dw || this.ditherImg.height != dh) {
			this.ditherImg = createImage(dw, dh);
		}
		let palette = colors.map(c => color(c).levels);
		this.ditherImg.loadPixels();
		let ip = this.ditherImg.pixels;
		for (let j = 0; j < total; j++) {
			if (idx[j] == NO_DITHER) {
				ip[j * 4 + 3] = 0;
				continue;
			}
			let rgb = palette[idx[j]];
			ip[j * 4] = rgb[0];
			ip[j * 4 + 1] = rgb[1];
			ip[j * 4 + 2] = rgb[2];
			ip[j * 4 + 3] = 255;
		}
		this.ditherImg.updatePixels();
	}

	draw() {
		if (!this.bgPG || this.bgPG.width != width || this.bgPG.height != height) {
			if (this.bgPG) this.bgPG.remove();
			this.bgPG = createGraphics(width, height);
			this.bgPG.pixelDensity(1);
		}
		this.bgPG.clear();

		for (let i = 0; i < this.points.length; i++) {
			let pos = this.points[i];

			if (i > 0) {
				let prevpos = this.points[i - 1];
				let dist = prevpos.dist(pos);
				let num = max(ceil(dist / this.divLen), 2);
				for (let n = 1; n < num; n++) {
					let t = n / (num - 1.0);

					let x = lerp(prevpos.x, pos.x, t);
					let y = lerp(prevpos.y, pos.y, t);
					this.bgPG.image(this.pg, x - this.pg.width * 0.5, y - this.pg.height * 0.5);
				}
			} else {
				this.bgPG.image(this.pg, pos.x - this.pg.width * 0.5, pos.y - this.pg.height * 0.5);
			}
		}
	}
}

// ---------- Dithering ----------
const NO_DITHER = 255;

function updateDithering() {
	background(bgColor);
	drawingContext.imageSmoothingEnabled = false;
	for (let b of blenders) {
		b.dither();
		if (b.ditherImg) {
			image(b.ditherImg, 0, 0, b.dw / b.sc, b.dh / b.sc);
		}
	}
	drawingContext.imageSmoothingEnabled = true;
}
 