const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const fontCache = {};
const localFontPaths = {};
const outputCache = {};

// Font usage note: This API runs on Vercel servers and uses fonts available in the server environment.
// System fonts (Arial, Helvetica, Times New Roman, etc.) should work via loadSystemFonts: true.
// Google Fonts are downloaded and cached on-demand. If a font isn't available, it will use fallbacks.

// Google Fonts direct download URLs (regular weight)
const GOOGLE_FONT_FILES = {
    'Inter': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp5GP3JTkwuP.woff2',
    'Fira Code': 'https://fonts.gstatic.com/s/firacode/v27/uU9NCBsR6Z2vfE9aq3bh3dSD.woff2',
    'Playfair Display': 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZtu5_iL6WsKxWjVubXXko0.woff2'
};

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
        return map[c];
    });
}

async function getBase64Image(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return url; // Already base64 or other URI
    }
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'image/png';
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (e) {
        console.error('Failed to inline image:', url, e);
        return url; // fallback to original url
    }
}

// Generate ETag for caching
function generateETag(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

// Generate cache key from query parameters
function generateCacheKey(query) {
    // Sort and stringify query parameters to create consistent cache keys
    const sortedParams = Object.keys(query).sort().reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
    }, {});
    return crypto.createHash('md5').update(JSON.stringify(sortedParams)).digest('hex');
}

// Compile active fonts: downloads woff2 files, caches them in /tmp, and outputs base64 CSS and local paths
async function compileFonts(fontFamilies) {
    let cssContent = '';
    const paths = [];
    const uniqueFonts = [...new Set(fontFamilies)];
    const tempDir = '/tmp';
    const cacheFile = path.join(tempDir, 'font_cache.json');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Try to load persistent cache from disk
    let persistentCache = {};
    try {
        if (fs.existsSync(cacheFile)) {
            const cacheData = fs.readFileSync(cacheFile, 'utf8');
            persistentCache = JSON.parse(cacheData);
            // Check if cache is less than 7 days old
            const cacheTime = persistentCache.timestamp || 0;
            const cacheAge = Date.now() - cacheTime;
            if (cacheAge > 7 * 24 * 60 * 60 * 1000) { // 7 days
                persistentCache = {}; // Cache expired
            }
        }
    } catch (e) {
        console.error('Failed to load font cache from disk:', e);
        persistentCache = {};
    }
    
    for (const font of uniqueFonts) {
        // Only process Google Fonts that are in our predefined list
        // Other fonts (Arial, Courier New, etc.) will use system fonts
        if (!GOOGLE_FONT_FILES[font]) {
            continue; // Skip Google Fonts compilation for system fonts
        }
        
        // Check in-memory cache first
        if (fontCache[font]) {
            cssContent += fontCache[font];
            if (localFontPaths[font]) {
                paths.push(...localFontPaths[font]);
            }
            continue;
        }
        
        // Check persistent cache
        if (persistentCache[font] && persistentCache[font].css) {
            fontCache[font] = persistentCache[font].css;
            localFontPaths[font] = persistentCache[font].paths || [];
            cssContent += fontCache[font];
            paths.push(...localFontPaths[font]);
            
            // Verify files still exist on disk
            for (const fontPath of localFontPaths[font]) {
                if (!fs.existsSync(fontPath)) {
                    // Cache invalidation - file missing
                    delete fontCache[font];
                    delete localFontPaths[font];
                    delete persistentCache[font];
                    break;
                }
            }
            
            if (fontCache[font]) continue; // Cache is valid
        }
        
        try {
            // 1. Fetch Google Fonts CSS using Chrome User-Agent to extract WOFF2 files
            const cssUrl = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;700&display=swap`;
            const cssRes = await fetch(cssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!cssRes.ok) throw new Error(`HTTP status ${cssRes.status}`);
            let cssText = await cssRes.text();
            
            // 2. Extract only /* latin */ subset blocks to keep payload size lightweight
            const regex = /\/\* latin \*\/\s*@font-face\s*\{[^}]+\}/g;
            let match;
            const blocks = [];
            while ((match = regex.exec(cssText)) !== null) {
                blocks.push(match[0]);
            }
            
            if (blocks.length === 0) {
                blocks.push(cssText); // Fallback to full CSS if regex finds nothing
            }
            
            let compiledCss = blocks.join('\n');
            const fontPaths = [];
            
            // 3. Extract font URLs from matching blocks
            const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
            const urlMatches = [];
            let urlMatch;
            while ((urlMatch = urlRegex.exec(compiledCss)) !== null) {
                urlMatches.push(urlMatch[1]);
            }
            
            const uniqueUrls = [...new Set(urlMatches)];
            
            // 4. Download and cache font files to /tmp, then replace urls with inline base64
            for (let i = 0; i < uniqueUrls.length; i++) {
                const fontUrl = uniqueUrls[i];
                const filename = `${font.replace(/ /g, '_')}_${i}.woff2`;
                const localPath = path.join(tempDir, filename);
                
                let buffer;
                if (fs.existsSync(localPath)) {
                    buffer = fs.readFileSync(localPath);
                } else {
                    const fontRes = await fetch(fontUrl);
                    if (!fontRes.ok) continue;
                    const arrayBuffer = await fontRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    fs.writeFileSync(localPath, buffer);
                }
                
                fontPaths.push(localPath);
                paths.push(localPath);
                
                const base64 = buffer.toString('base64');
                const dataUrl = `data:font/woff2;base64,${base64}`;
                compiledCss = compiledCss.split(fontUrl).join(dataUrl);
            }
            
            fontCache[font] = compiledCss;
            localFontPaths[font] = fontPaths;
            cssContent += compiledCss;
            
            // Update persistent cache
            persistentCache[font] = {
                css: compiledCss,
                paths: fontPaths,
                timestamp: Date.now()
            };
        } catch (e) {
            console.error(`Failed to compile font ${font}:`, e);
        }
    }
    
    // Save persistent cache to disk
    try {
        persistentCache.timestamp = Date.now();
        fs.writeFileSync(cacheFile, JSON.stringify(persistentCache));
    } catch (e) {
        console.error('Failed to save font cache to disk:', e);
    }
    
    return { css: cssContent, paths };
}

module.exports = async (req, res) => {
    try {
        const q = req.query;
        
        // Check output cache for existing response
        const cacheKey = generateCacheKey(q);
        if (outputCache[cacheKey]) {
            const cached = outputCache[cacheKey];
            // Check if cache is still valid (less than 1 hour old)
            if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
                // Verify client cache with ETag
                if (req.headers['if-none-match'] === cached.etag) {
                    res.status(304).end();
                    return;
                }
                
                // Set headers and send cached response
                if (q.download === 'true') {
                    res.setHeader('Content-Disposition', cached.contentDisposition);
                }
                res.setHeader('Content-Type', cached.contentType);
                res.setHeader('ETag', cached.etag);
                res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
                res.status(200).send(cached.data);
                return;
            } else {
                // Cache expired, remove it
                delete outputCache[cacheKey];
            }
        }

        // Canvas settings
        const w = Math.min(parseInt(q.w) || 800, 2000);
        const h = Math.min(parseInt(q.h) || 200, 2000);
        if (isNaN(w) || isNaN(h) || w < 10 || h < 10) throw new Error('Invalid dimensions');
        const radius = Math.min(parseInt(q.r) || 20, 200);
        
        // Background color validation
        let bg = q.bg || '#0f172a';
        if (bg !== 'transparent' && !bg.match(/^#[0-9a-fA-F]{3,8}$/)) {
            bg = '#0f172a';
        }

        // Parse layers preserving parameter order
        const allLayers = [];
        
        // Get raw query string to preserve parameter order
        const rawQuery = req.url.split('?')[1];
        if (rawQuery) {
            const paramPairs = rawQuery.split('&');
            const maxLayers = 20; // Max 10 text + 10 image layers
            let layerCount = 0;
            
            for (let i = 0; i < paramPairs.length && layerCount < maxLayers; i++) {
                const pair = paramPairs[i];
                const eqIndex = pair.indexOf('=');
                if (eqIndex === -1) continue;
                
                const key = pair.substring(0, eqIndex);
                const value = pair.substring(eqIndex + 1);
                
                try {
                    const decodedKey = decodeURIComponent(key);
                    const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
                    
                    if (decodedKey === 'text') {
                        const parts = decodedValue.split(',');
                        if (parts[0]) {
                            const content = parts[0].slice(0, 200);
                            const x = parseFloat(parts[1]) || w / 2;
                            const y = parseFloat(parts[2]) || h / 2;
                            const fontSize = Math.min(parseFloat(parts[3]) || 36, 200);
                            const color = parts[4]?.match(/^#[0-9a-fA-F]{3,8}$/) ? parts[4] : '#ffffff';
                            const rotation = parseFloat(parts[5]) || 0;
                            const anchor = ['start', 'middle', 'end'].includes(parts[6]) ? parts[6] : 'middle';
                            const fontFamily = (parts[7] || 'Arial').slice(0, 50);
                            
                            if (!isNaN(x) && !isNaN(y) && !isNaN(fontSize) && !isNaN(rotation)) {
                                allLayers.push({ type: 'text', content, x, y, fontSize, color, rotation, anchor, fontFamily });
                                layerCount++;
                            }
                        }
                    } else if (decodedKey === 'image') {
                        const parts = decodedValue.split(',');
                        if (parts[0]) {
                            let url = parts[0].slice(0, 1000);
                            
                            // Fetch and inline external image to base64
                            if (url.startsWith('http')) {
                                url = await getBase64Image(url);
                            }
                            
                            const x = parseFloat(parts[1]) || 10;
                            const y = parseFloat(parts[2]) || 10;
                            const width = parseFloat(parts[3]) || 60;
                            const height = parseFloat(parts[4]) || 60;
                            const rotation = parseFloat(parts[5]) || 0;
                            
                            if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height) && !isNaN(rotation)) {
                                allLayers.push({ type: 'image', url, x, y, width, height, rotation });
                                layerCount++;
                            }
                        }
                    }
                } catch (e) {
                    // Skip malformed parameters
                    continue;
                }
            }
        }

        // Don't reverse - params received as [bottom, ..., top] so top renders last (on top)

        // Fetch and inline all active fonts (for SVG output and Resvg backend paths)
        const fontFamilies = allLayers.filter(l => l.type === 'text').map(t => t.fontFamily);
        const { css: inlineFontsCss, paths: fontPaths } = await compileFonts(fontFamilies);
        
        // Check if any Google Fonts are actually being used
        const usesGoogleFonts = fontFamilies.some(font => GOOGLE_FONT_FILES[font]);

        // Build SVG
        const svgParts = [
            `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`,
            `<defs><style><![CDATA[`
        ];
        
        // Embed Google Fonts inside CDATA block (only if Google Fonts are actually used)
        if (usesGoogleFonts && inlineFontsCss) {
            svgParts.push(inlineFontsCss);
        } else if (usesGoogleFonts) {
            // Fallback imports if server fetch is temporarily unavailable
            svgParts.push(
                `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');`,
                `@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');`,
                `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');`
            );
        }
        svgParts.push(`]]></style></defs>`);

        const fillBg = bg === 'transparent' ? 'none' : bg;
        svgParts.push(`<rect width="100%" height="100%" rx="${radius}" fill="${fillBg}"/>`);

        // Font fallback map for better system font support
        const fallbackMap = {
            'Arial': 'Arial, Helvetica, sans-serif',
            'Helvetica': 'Helvetica, Arial, sans-serif',
            'Times New Roman': 'Times New Roman, Times, serif',
            'Georgia': 'Georgia, Times New Roman, serif',
            'Courier New': 'Courier New, Courier, monospace',
            'Verdana': 'Verdana, Arial, sans-serif'
        };

        // Process layers in order (first = bottom, last = top, so top renders on top)
        for (const layer of allLayers) {
            if (layer.type === 'image') {
                const urlEscaped = escapeXml(layer.url);
                if (layer.rotation === 0) {
                    svgParts.push(`<image href="${urlEscaped}" xlink:href="${urlEscaped}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/>`);
                } else {
                    svgParts.push(`<g transform="translate(${layer.x},${layer.y}) rotate(${layer.rotation})"><image href="${urlEscaped}" xlink:href="${urlEscaped}" x="0" y="0" width="${layer.width}" height="${layer.height}"/></g>`);
                }
            } else if (layer.type === 'text') {
                const content = escapeXml(layer.content);
                if (!content) continue;
                
                const transform = layer.rotation !== 0 ? ` transform="rotate(${layer.rotation} ${layer.x} ${layer.y})"` : '';
                const fontFamily = escapeXml(layer.fontFamily);
                const fontFamilyStack = fallbackMap[fontFamily] || fontFamily;
                
                svgParts.push(`<text x="${layer.x}" y="${layer.y}" dy="0.35em" font-family="${fontFamilyStack}" font-size="${layer.fontSize}" fill="${layer.color}" text-anchor="${layer.anchor}"${transform}>${content}</text>`);
            }
        }
        svgParts.push(`</svg>`);
        
        const svg = svgParts.join('');

        // Handle format response
        if (q.format === 'png') {
            const resvg = new Resvg(svg, {
                fitTo: {
                    mode: 'width',
                    value: w,
                },
                font: {
                    fontFiles: fontPaths,
                    loadSystemFonts: true,
                    defaultFontFamily: 'Arial'
                }
            });
            const pngData = resvg.render();
            const pngBuffer = pngData.asPng();
            const etag = generateETag(pngBuffer);

            // Check if client has cached version
            if (req.headers['if-none-match'] === etag) {
                res.status(304).end();
                return;
            }

            if (q.download === 'true') {
                res.setHeader('Content-Disposition', 'attachment; filename="banner.png"');
            }
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('ETag', etag);
            // Enhanced caching for Vercel CDN
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
            
            // Cache the output
            outputCache[cacheKey] = {
                data: pngBuffer,
                contentType: 'image/png',
                etag: etag,
                contentDisposition: q.download === 'true' ? 'attachment; filename="banner.png"' : null,
                timestamp: Date.now()
            };
            
            res.status(200).send(pngBuffer);
        } else {
            const etag = generateETag(svg);

            // Check if client has cached version
            if (req.headers['if-none-match'] === etag) {
                res.status(304).end();
                return;
            }

            if (q.download === 'true') {
                res.setHeader('Content-Disposition', 'attachment; filename="banner.svg"');
            }
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('ETag', etag);
            // Enhanced caching for Vercel CDN
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
            
            // Cache the output
            outputCache[cacheKey] = {
                data: svg,
                contentType: 'image/svg+xml',
                etag: etag,
                contentDisposition: q.download === 'true' ? 'attachment; filename="banner.svg"' : null,
                timestamp: Date.now()
            };
            
            res.status(200).send(svg);
        }
    } catch (err) {
        console.error('SVG error:', err);
        res.status(500).send('Error: ' + err.message);
    }
};