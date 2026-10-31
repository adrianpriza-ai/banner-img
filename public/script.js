// Unified layer system
let layers = [
	{ type: 'text', content: "New [gitver/adrianpriza-ai/alps] Released", x: 400, y: 100, fontSize: 40, color: "#ffffff", rotation: 0, anchor: "middle", fontFamily: "Arial", clip: true },
	{ type: 'image', url: "https://picsum.photos/id/104/80/80", x: 20, y: 60, width: 80, height: 80, rotation: 0, clip: true }
];

let debounceTimer = null;

// BG style toggle listener
document.getElementById('bg-type').addEventListener('change', function(e) {
	const wrapper = document.getElementById('bg-color-wrapper');
	if (e.target.value === 'transparent') {
		wrapper.style.display = 'none';
	} else {
		wrapper.style.display = 'block';
	}
	debouncedUpdate();
});

// Color sync listeners
document.getElementById('bg').addEventListener('input', function(e) {
	document.getElementById('bg-hex').value = e.target.value;
	debouncedUpdate();
});
document.getElementById('bg-hex').addEventListener('input', function(e) {
	const val = e.target.value.trim();
	if (val.match(/^#[0-9a-fA-F]{6}$/)) {
		document.getElementById('bg').value = val;
		debouncedUpdate();
	}
});

// Event listeners on inputs
document.querySelectorAll('#w, #h, #r').forEach(el => el.addEventListener('input', debouncedUpdate));

// Format helper to escape XML special chars
function escapeXml(unsafe) {
	if (!unsafe) return '';
	return unsafe.replace(/[<>&'"]/g, (c) => {
		const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
		return map[c];
	});
}

// Helper function to replace gitver patterns with preview version
function previewGitverPatterns(text) {
	if (!text) return text;
	return text.replace(/\[gitver\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\]/g, 'v1.0.0');
}

// A text layer's font can be a family name or a URL to a font file (.ttf/.otf/.woff/.woff2)
function isFontUrl(value) {
	return /^https?:\/\//i.test(value || '');
}

// Browsers honor the @font-face we emit in the SVG, so any stable name works.
// A short deterministic hash keeps different URLs from colliding.
function svgFontFamilyName(fontFamily) {
	if (!isFontUrl(fontFamily)) return fontFamily;
	let hash = 5381;
	for (let i = 0; i < fontFamily.length; i++) {
		hash = ((hash * 33) ^ fontFamily.charCodeAt(i)) >>> 0;
	}
	return 'font-' + hash.toString(36);
}

// SVG String Generator
function buildSvgCode(formatted = false) {
	const w = parseInt(document.getElementById('w').value) || 800;
	const h = parseInt(document.getElementById('h').value) || 200;
	const radius = parseInt(document.getElementById('r').value) || 20;
	
	const isTransparent = document.getElementById('bg-type').value === 'transparent';
	const bgVal = isTransparent ? 'none' : (document.getElementById('bg-hex').value || '#0f172a');

	const nl = formatted ? '\n' : '';
	const tab = formatted ? '  ' : '';

	let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${nl}`;
	
	// Embed google fonts style links inside CDATA block
	svg += `${tab}<defs>${nl}`;
	svg += `${tab}${tab}<style><![CDATA[${nl}`;
	svg += `${tab}${tab}${tab}@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');${nl}`;
	svg += `${tab}${tab}${tab}@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');${nl}`;
	svg += `${tab}${tab}${tab}@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');${nl}`;

	// Declare remote font files (.ttf/.otf/.woff/.woff2) referenced by text layers
	const urlFonts = [...new Set(layers.filter(l => l.type === 'text' && isFontUrl(l.fontFamily)).map(l => l.fontFamily))];
	for (const fontUrl of urlFonts) {
		svg += `${tab}${tab}${tab}@font-face { font-family: '${svgFontFamilyName(fontUrl)}'; src: url('${fontUrl}'); }${nl}`;
	}

	svg += `${tab}${tab}]]></style>${nl}`;
	
	// Add per-layer clip paths for layers that have clipping enabled
	let clipCounter = 0;
	for (let i = layers.length - 1; i >= 0; i--) {
		const layer = layers[i];
		if (layer.clip) {
			svg += `${tab}${tab}<clipPath id="clip-${clipCounter}"><rect width="100%" height="100%" rx="${radius}"/></clipPath>${nl}`;
			layer.clipId = `clip-${clipCounter}`;
			clipCounter++;
		}
	}
	
	svg += `${tab}</defs>${nl}`;

	svg += `${tab}<rect width="100%" height="100%" rx="${radius}" fill="${bgVal}"/>${nl}`;

	// Add layers in reverse order (top layer in UI = last in SVG = rendered on top)
	for (let i = layers.length - 1; i >= 0; i--) {
		const layer = layers[i];
		if (layer.type === 'image') {
			if (!layer.url) continue;
			const urlEscaped = escapeXml(layer.url);
			const clipAttr = layer.clip ? ` clip-path="url(#${layer.clipId})"` : '';
			
			if (layer.rotation === 0) {
				svg += `${tab}<g${clipAttr}><image href="${urlEscaped}" xlink:href="${urlEscaped}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/></g>${nl}`;
			} else {
				svg += `${tab}<g transform="translate(${layer.x},${layer.y}) rotate(${layer.rotation})"${clipAttr}><image href="${urlEscaped}" xlink:href="${urlEscaped}" x="0" y="0" width="${layer.width}" height="${layer.height}"/></g>${nl}`;
			}
		} else if (layer.type === 'text') {
			const previewContent = previewGitverPatterns(layer.content);
			const contentEscaped = escapeXml(previewContent);
			if (!contentEscaped) continue;
			let transform = '';
			if (layer.rotation !== 0) {
				transform = ` transform="rotate(${layer.rotation} ${layer.x} ${layer.y})"`;
			}
			const clipAttr = layer.clip ? ` clip-path="url(#${layer.clipId})"` : '';
			let svgAnchor = layer.anchor;
			if (svgAnchor === 'start') svgAnchor = 'end';
			else if (svgAnchor === 'end') svgAnchor = 'start';
			svg += `${tab}<g${clipAttr}><text x="${layer.x}" y="${layer.y}" dy="0.35em" font-family="${escapeXml(svgFontFamilyName(layer.fontFamily))}" font-size="${layer.fontSize}" fill="${layer.color}" text-anchor="${svgAnchor}"${transform}>${contentEscaped}</text></g>${nl}`;
		}
	}

	svg += `</svg>`;
	return svg;
}

// Build query parameters (shared helper)
function buildQueryParams() {
	const params = new URLSearchParams();
	params.set('w', document.getElementById('w').value);
	params.set('h', document.getElementById('h').value);
	params.set('r', document.getElementById('r').value);

	const isTransparent = document.getElementById('bg-type').value === 'transparent';
	params.set('bg', isTransparent ? 'transparent' : document.getElementById('bg-hex').value);

	// Send layers in reverse order so first param = top layer
	for (let i = layers.length - 1; i >= 0; i--) {
		const layer = layers[i];
		if (layer.type === 'text') {
			const encodedContent = encodeURIComponent(layer.content);
			const parts = [encodedContent, layer.x, layer.y, layer.fontSize, layer.color, layer.rotation, layer.anchor, layer.fontFamily, layer.clip ? 'true' : 'false'];
			params.append('text', parts.join(','));
		} else if (layer.type === 'image') {
			const encodedUrl = encodeURIComponent(layer.url);
			const parts = [encodedUrl, layer.x, layer.y, layer.width, layer.height, layer.rotation, layer.clip ? 'true' : 'false'];
			params.append('image', parts.join(','));
		}
	}
	return params;
}

// Build Server URL
function buildServerQueryString() {
	const params = buildQueryParams();
	return `/api/banner?${params.toString()}`;
}

// Build Shareable Editor link
function buildShareableEditorLink() {
	const params = buildQueryParams();
	return window.location.origin + window.location.pathname + '?' + params.toString();
}

// Render preview and raw code
function updatePreview() {
	const svgCode = buildSvgCode(false);
	const formattedSvgCode = buildSvgCode(true);
	const previewViewport = document.getElementById('preview-viewport');
	const svgDocument = new DOMParser().parseFromString(svgCode, 'image/svg+xml');
	const svgElement = svgDocument.documentElement;
	previewViewport.replaceChildren(svgElement);
	// Update raw source box
	document.getElementById('rawSvgSource').value = formattedSvgCode;

	// Update URL box
	const serverUrl = window.location.origin + buildServerQueryString();
	document.getElementById('apiUrlBox').value = serverUrl;
}

function debouncedUpdate() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(updatePreview, 100);
}

// Render unified layers list without parsing user-controlled HTML.
function renderLayers() {
	const container = document.getElementById('layersContainer');
	container.replaceChildren();

	const createField = (tag, className, type, value, labelText) => {
		const wrapper = document.createElement('div');
		const label = document.createElement('label');
		label.textContent = labelText;
		const input = document.createElement(tag);
		input.className = className;
		if (type) input.type = type;
		if (tag === 'input' && type === 'checkbox') input.checked = Boolean(value);
		else input.value = value ?? '';
		wrapper.append(label, input);
		return { wrapper, input };
	};

	layers.forEach((layer, idx) => {
		const card = document.createElement('div');
		card.className = 'layer-card';
		const header = document.createElement('div');
		header.className = 'layer-header';
		const title = document.createElement('span');
		title.textContent = `${layer.type === 'text' ? 'Text' : 'Image'} Layer #${idx + 1}`;
		const actions = document.createElement('div');
		const action = (text, className, handler, disabled = false) => {
			const button = document.createElement('button');
			button.className = `small${className ? ` ${className}` : ''}`;
			button.type = 'button';
			button.textContent = text;
			button.disabled = disabled;
			button.addEventListener('click', handler);
			actions.appendChild(button);
		};
		action('↑', '', () => moveLayer(idx, -1), idx === 0);
		action('↓', '', () => moveLayer(idx, 1), idx === layers.length - 1);
		action('Duplicate', 'success', () => duplicateLayer(idx));
		action('Remove', 'danger', () => removeLayer(idx));
		header.append(title, actions);
		card.appendChild(header);

		if (layer.type === 'text') {
			const rowOne = document.createElement('div');
			rowOne.className = 'row';
			const content = createField('input', 'txt-content', 'text', layer.content, 'Content');
			content.wrapper.className = 'full-width';
			content.wrapper.style.flex = '2';
			content.input.style.width = '100%';
			const hint = document.createElement('div');
			hint.className = 'hint';
			hint.textContent = 'Use [gitver/owner/repo] for auto version fetching (preview shows v1.0.0)';
			content.wrapper.appendChild(hint);
			rowOne.append(content.wrapper, createField('input', 'txt-x', 'number', layer.x, 'X').wrapper, createField('input', 'txt-y', 'number', layer.y, 'Y').wrapper, createField('input', 'txt-size', 'number', layer.fontSize, 'Size').wrapper);
			const rowTwo = document.createElement('div');
			rowTwo.className = 'row';
			const color = createField('input', 'txt-color-hex', 'text', layer.color, 'Color');
			const picker = document.createElement('input');
			picker.className = 'txt-color'; picker.type = 'color'; picker.value = layer.color.slice(0, 7);
			color.wrapper.appendChild(picker);
			const rotation = createField('input', 'txt-rot', 'number', layer.rotation, 'Rotation');
			const anchor = createField('select', 'txt-anchor', '', '', 'Anchor');
			['start', 'middle', 'end'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; option.selected = layer.anchor === value; anchor.input.appendChild(option); });
			const font = createField('input', 'txt-font', 'text', layer.fontFamily, 'Font');
			font.input.setAttribute('list', 'fontPresets'); font.input.placeholder = 'Arial or font URL'; font.input.style.width = '160px';
			const fontHint = document.createElement('div'); fontHint.className = 'hint'; fontHint.textContent = 'Family name, Google Font, or .ttf/.otf/.woff/.woff2 URL'; font.wrapper.appendChild(fontHint);
			const clip = createField('input', 'txt-clip', 'checkbox', layer.clip, 'Clip'); clip.input.style.width = 'auto';
			rowTwo.append(color.wrapper, rotation.wrapper, anchor.wrapper, font.wrapper, clip.wrapper);
			card.append(rowOne, rowTwo);

			const syncData = () => { layers[idx].content = content.input.value; layers[idx].x = parseFloat(rowOne.querySelector('.txt-x').value) || 0; layers[idx].y = parseFloat(rowOne.querySelector('.txt-y').value) || 0; layers[idx].fontSize = parseFloat(rowOne.querySelector('.txt-size').value) || 10; layers[idx].color = color.input.value; layers[idx].rotation = parseFloat(rotation.input.value) || 0; layers[idx].anchor = anchor.input.value; layers[idx].fontFamily = font.input.value; layers[idx].clip = clip.input.checked; debouncedUpdate(); };
			picker.addEventListener('input', () => { color.input.value = picker.value; layers[idx].color = picker.value; debouncedUpdate(); });
			[color.input, picker, content.input, rotation.input, anchor.input, font.input, clip.input, ...rowOne.querySelectorAll('input')].forEach(input => { input.addEventListener('input', syncData); input.addEventListener('change', syncData); });
		} else {
			const sourceRow = document.createElement('div'); sourceRow.className = 'row';
			const source = createField('input', 'img-url', 'text', layer.url.startsWith('data:') ? '[Base64 Image]' : layer.url, 'Image Source URL'); source.wrapper.className = 'full-width'; source.wrapper.style.flex = '3'; source.input.style.width = '100%'; source.input.placeholder = 'https://example.com/logo.png';
			const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Supports PNG, JPG, GIF, SVG, WebP, and base64 data URLs'; source.wrapper.appendChild(hint); sourceRow.appendChild(source.wrapper); card.appendChild(sourceRow);
			const row = document.createElement('div'); row.className = 'row';
			['x', 'y', 'w', 'h', 'rot'].forEach(key => row.appendChild(createField('input', `img-${key}`, 'number', layer[key === 'w' ? 'width' : key === 'h' ? 'height' : key === 'rot' ? 'rotation' : key], key === 'w' ? 'Width' : key === 'h' ? 'Height' : key === 'rot' ? 'Rotation' : key.toUpperCase()).wrapper));
			const clip = createField('input', 'img-clip', 'checkbox', layer.clip, 'Clip'); clip.input.style.width = 'auto'; row.appendChild(clip.wrapper); card.appendChild(row);
			const syncImageData = () => { if (source.input.value !== '[Base64 Image]') layers[idx].url = source.input.value; layers[idx].x = parseFloat(row.querySelector('.img-x').value) || 0; layers[idx].y = parseFloat(row.querySelector('.img-y').value) || 0; layers[idx].width = parseFloat(row.querySelector('.img-w').value) || 0; layers[idx].height = parseFloat(row.querySelector('.img-h').value) || 0; layers[idx].rotation = parseFloat(row.querySelector('.img-rot').value) || 0; layers[idx].clip = clip.input.checked; debouncedUpdate(); };
			row.querySelectorAll('input').forEach(input => { input.addEventListener('input', syncImageData); input.addEventListener('change', syncImageData); }); source.input.addEventListener('input', syncImageData); source.input.addEventListener('change', syncImageData);
		}
		container.appendChild(card);
	});
}

// Layer manipulators
function removeLayer(idx) { 
	layers.splice(idx, 1); 
	renderLayers(); 
	debouncedUpdate(); 
}

function moveLayer(idx, direction) {
	const newIdx = idx + direction;
	if (newIdx < 0 || newIdx >= layers.length) return;
	
	// Swap layers
	[layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
	renderLayers();
	debouncedUpdate();
}

function duplicateLayer(idx) {
	const duplicate = { ...layers[idx] };
	// Offset position slightly so they don't overlap completely
	duplicate.x += 20;
	duplicate.y += 20;
	layers.splice(idx + 1, 0, duplicate);
	renderLayers();
	debouncedUpdate();
}

document.getElementById('addTextBtn').onclick = () => {
	const w = parseInt(document.getElementById('w').value) || 800;
	const h = parseInt(document.getElementById('h').value) || 200;
	layers.push({ type: 'text', content: "New text", x: Math.round(w/2), y: Math.round(h/2), fontSize: 32, color: "#ffffff", rotation: 0, anchor: "middle", fontFamily: "Arial", clip: true });
	renderLayers();
	debouncedUpdate();
};

document.getElementById('addImageBtn').onclick = () => {
	layers.push({ type: 'image', url: "https://picsum.photos/id/102/80/80", x: 50, y: 60, width: 80, height: 80, rotation: 0, clip: true });
	renderLayers();
	debouncedUpdate();
};

// Download SVG client-side
function downloadSVG() {
	const svgCode = buildSvgCode(true);
	const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = 'banner.svg';
	a.click();
}

// Download PNG (Server-side rendering via Resvg, falls back to canvas if offline)
function downloadPNG() {
	// Check if running on local file system without a running dev server
	if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && !window.location.port)) {
		downloadPngClientSide();
		return;
	}

	// Flawless server-side Resvg downloader (correctly processes fonts & nested Base64 graphics)
	const query = buildServerQueryString();
	const pngDownloadUrl = window.location.origin + query + '&format=png&download=true';
	window.location.href = pngDownloadUrl;
}

// Client-side canvas rendering fallback
function downloadPngClientSide() {
	const w = parseInt(document.getElementById('w').value) || 800;
	const h = parseInt(document.getElementById('h').value) || 200;
	const svgCode = buildSvgCode(false);

	const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
	const blobUrl = URL.createObjectURL(blob);

	const image = new Image();
	image.onload = function() {
		// Wait for sub-resources (like Base64 encoded images) to decode inside the SVG
		setTimeout(() => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const context = canvas.getContext('2d');
				context.drawImage(image, 0, 0);

				const a = document.createElement('a');
				a.href = canvas.toDataURL('image/png');
				a.download = 'banner.png';
				a.click();
			} catch (e) {
				alert('Local canvas download blocked. Please run a local web server, or use absolute, CORS-enabled URLs for your image layers to bypass CORS restrictions.');
				console.error(e);
			} finally {
				URL.revokeObjectURL(blobUrl);
			}
		}, 150);
	};
	image.onerror = function() {
		alert('Rendering failed! Check your elements.');
		URL.revokeObjectURL(blobUrl);
	};
	image.src = blobUrl;
}

// Copy integrations
function copyMarkdown() {
	const url = window.location.origin + buildServerQueryString();
	navigator.clipboard.writeText(`![Banner](${url})`);
	alert('Markdown code copied!');
}
function copyServerUrl() {
	const url = window.location.origin + buildServerQueryString();
	navigator.clipboard.writeText(url);
	alert('API URL copied!');
}
function copyEditorUrl() {
	const url = buildShareableEditorLink();
	navigator.clipboard.writeText(url);
	alert('Shareable editor link copied!');
}

// URL Decoder & Importer
function decodeInputUrl() {
	const val = document.getElementById('decodeInput').value;
	if (!val) {
		alert('Please enter a URL first!');
		return;
	}
	decodeBannerUrl(val);
}

function decodeBannerUrl(urlString) {
	try {
		let cleanUrl = urlString.trim();

		// Clean markdown link formatting (e.g. ![Banner](http://...))
		const markdownMatch = cleanUrl.match(/!\[.*?\]\((.*?)\)/);
		if (markdownMatch) {
			cleanUrl = markdownMatch[1];
		}

		// Make sure we have a query string structure to parse
		if (cleanUrl.startsWith('?')) {
			cleanUrl = 'http://example.com/api/banner' + cleanUrl;
		} else if (!cleanUrl.includes('?') && cleanUrl.includes('=')) {
			cleanUrl = 'http://example.com/api/banner?' + cleanUrl;
		} else if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
			cleanUrl = 'http://example.com' + cleanUrl;
		}

		const url = new URL(cleanUrl);
		const params = url.searchParams;

		// Decode Canvas dimensions
		if (params.has('w')) document.getElementById('w').value = params.get('w');
		if (params.has('h')) document.getElementById('h').value = params.get('h');
		if (params.has('r')) document.getElementById('r').value = params.get('r');
		
		if (params.has('bg')) {
			const bgVal = params.get('bg');
			const bgTypeSelect = document.getElementById('bg-type');
			const bgHex = document.getElementById('bg-hex');
			const bgPick = document.getElementById('bg');
			
			if (bgVal === 'transparent') {
				bgTypeSelect.value = 'transparent';
				document.getElementById('bg-color-wrapper').style.display = 'none';
			} else {
				bgTypeSelect.value = 'solid';
				document.getElementById('bg-color-wrapper').style.display = 'block';
				bgHex.value = bgVal;
				if (bgVal.match(/^#[0-9a-fA-F]{6}$/)) {
					bgPick.value = bgVal;
				}
			}
		}

		// Decode Layers (unified text and image) - preserve parameter order
		// Clear existing layers first
		layers = [];
		
		// Parse the raw query string to preserve parameter order
		const rawQueryString = cleanUrl.split('?')[1];
		if (rawQueryString) {
			const paramPairs = rawQueryString.split('&');
			
			for (const pair of paramPairs) {
				const [key, value] = pair.split('=');
				if (!key || !value) continue;
				
				const decodedKey = decodeURIComponent(key);
				const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
				
				if (decodedKey === 'text') {
					const parts = decodedValue.split(',');
					if (!parts[0]) continue;
					
					let content = parts[0];
					try { content = decodeURIComponent(content.replace(/\+/g, ' ')); } catch(e) {}
					
					let x = parseFloat(parts[1]);
					let y = parseFloat(parts[2]);
					if (isNaN(x)) x = 0;
					if (isNaN(y)) y = 0;
					const fontSize = parseFloat(parts[3]) || 24;
					const color = parts[4] || '#ffffff';
					const rotation = parseFloat(parts[5]) || 0;
					const anchor = parts[6] || 'middle';
					const fontFamily = parts[7] || 'Arial';
					const clip = (parts[8] || 'true') === 'true';

					layers.push({ type: 'text', content, x, y, fontSize, color, rotation, anchor, fontFamily, clip });
				} else if (decodedKey === 'image') {
					const parts = decodedValue.split(',');
					if (!parts[0]) continue;
					
					let urlVal = parts[0];
					try { urlVal = decodeURIComponent(urlVal.replace(/\+/g, ' ')); } catch(e) {}
					
					let x = parseFloat(parts[1]);
					let y = parseFloat(parts[2]);
					if (isNaN(x)) x = 0;
					if (isNaN(y)) y = 0;
					const width = parseFloat(parts[3]) || 60;
					const height = parseFloat(parts[4]) || 60;
					const rotation = parseFloat(parts[5]) || 0;
					const clip = (parts[6] || 'true') === 'true';

					layers.push({ type: 'image', url: urlVal, x, y, width, height, rotation, clip });
				}
			}
		}
		
		// URL building sends [bottom, ..., top] so params received as [bottom, ..., top]
		// Reverse to get [top, ..., bottom] for UI display
		layers.reverse();

		renderLayers();
		updatePreview();
		alert('Successfully decoded and loaded banner parameters!');
	} catch (err) {
		alert('Invalid URL parameter structure.');
		console.error(err);
	}
}

// Zoom & Pan state
let scale = 1, panX = 0, panY = 0, isDragging = false, startX = 0, startY = 0;
const previewEl = document.getElementById('preview');
const viewportEl = document.getElementById('preview-viewport');

const applyTransform = () => {
	viewportEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
};

function zoomIn(e) { e.preventDefault(); scale = Math.min(scale * 1.2, 8); applyTransform(); }
function zoomOut(e) { e.preventDefault(); scale = Math.max(scale / 1.2, 0.1); applyTransform(); }
function zoomReset(e) { e.preventDefault(); scale = 1; panX = 0; panY = 0; applyTransform(); }

previewEl.addEventListener('pointerdown', (e) => {
	if (e.target.closest('.zoom-controls')) return;
	isDragging = true;
	startX = e.clientX - panX;
	startY = e.clientY - panY;
	previewEl.style.cursor = 'grabbing';
	previewEl.setPointerCapture(e.pointerId);
	e.preventDefault();
});

previewEl.addEventListener('pointermove', (e) => {
	if (!isDragging) return;
	panX = e.clientX - startX;
	panY = e.clientY - startY;
	applyTransform();
});

previewEl.addEventListener('pointerup', (e) => {
	if (isDragging) {
		isDragging = false;
		previewEl.style.cursor = 'grab';
		previewEl.releasePointerCapture(e.pointerId);
	}
});
previewEl.addEventListener('pointercancel', (e) => {
	if (isDragging) {
		isDragging = false;
		previewEl.style.cursor = 'grab';
		previewEl.releasePointerCapture(e.pointerId);
	}
});

previewEl.addEventListener('wheel', (e) => {
	e.preventDefault();
	scale = e.deltaY < 0 ? Math.min(scale * 1.1, 8) : Math.max(scale / 1.1, 0.1);
	applyTransform();
}, { passive: false });

// Initialize state
window.addEventListener('DOMContentLoaded', () => {
	if (window.location.search) {
		decodeBannerUrl(window.location.href);
	} else {
		renderLayers();
		updatePreview();
	}
});
