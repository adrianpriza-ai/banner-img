const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const fontCache = {};
const localFontPaths = {};
const outputCache = {};
const OUTPUT_CACHE_MAX_SIZE = 50; // Limit in-memory cache size (serverless environment)

// Font usage note: This API runs on Vercel servers and uses fonts available in the server environment.
// System fonts (Arial, Helvetica, Times New Roman, etc.) should work via loadSystemFonts: true.
// Google Fonts are downloaded and cached on-demand. If a font isn't available, it will use fallbacks.

// Google Fonts direct download URLs (regular weight)
const GOOGLE_FONT_FILES = {
    'Inter': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp5GP3JTkwuP.woff2',
    'Fira Code': 'https://fonts.gstatic.com/s/firacode/v27/uU9NCBsR6Z2vfE9aq3bh3dSD.woff2',
    'Playfair Display': 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZtu5_iL6WsKxWjVubXXko0.woff2'
};

// Pre-compiled regex patterns for better performance
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}){0,2}$/;
const LATIN_FONT_BLOCK_REGEX = /\/\* latin \*\/\s*@font-face\s*\{[^}]+\}/g;
const FONT_URL_REGEX = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
const GITVER_REGEX = /\[gitver\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\]/g;

// Cache for GitHub version fetching
const gitverCache = {};
const GITVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Fetch GitHub version for a repository
async function getGitHubVersion(repo) {
    const now = Date.now();
    
    // Check cache first
    if (gitverCache[repo] && (now - gitverCache[repo].timestamp < GITVER_CACHE_TTL)) {
        return gitverCache[repo].version;
    }
    
    try {
        const githubApiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
        const response = await fetch(githubApiUrl, {
            headers: {
                'User-Agent': 'banner-img-api',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch version for ${repo}: ${response.status}`);
            return `[gitver/${repo}]`; // Return original pattern on error
        }

        const releaseData = await response.json();
        const version = releaseData.tag_name || releaseData.name || 'unknown';
        
        // Cache the result
        gitverCache[repo] = {
            version: version,
            timestamp: now
        };
        
        return version;
    } catch (err) {
        console.error(`Error fetching version for ${repo}:`, err);
        return `[gitver/${repo}]`; // Return original pattern on error
    }
}

// Replace gitver patterns in text with actual versions
async function replaceGitverPatterns(text) {
    const matches = text.match(GITVER_REGEX);
    if (!matches) return text;
    
    let result = text;
    
    // Process each unique repo
    const uniqueRepos = [...new Set(matches.map(m => m.match(/\[gitver\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\]/)[1]))];
    
    for (const repo of uniqueRepos) {
        const pattern = `[gitver/${repo}]`;
        const version = await getGitHubVersion(repo);
        result = result.split(pattern).join(version);
    }
    
    return result;
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
            let cacheValid = true;
            for (const fontPath of localFontPaths[font]) {
                if (!fs.existsSync(fontPath)) {
                    // Cache invalidation - file missing
                    delete fontCache[font];
                    delete localFontPaths[font];
                    delete persistentCache[font];
                    cacheValid = false;
                    break;
                }
            }
            
            if (cacheValid && fontCache[font]) continue; // Cache is valid
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
            let match;
            const blocks = [];
            while ((match = LATIN_FONT_BLOCK_REGEX.exec(cssText)) !== null) {
                blocks.push(match[0]);
            }
            
            if (blocks.length === 0) {
                blocks.push(cssText); // Fallback to full CSS if regex finds nothing
            }
            
            let compiledCss = blocks.join('\n');
            const fontPaths = [];
            
            // 3. Extract font URLs from matching blocks
            const urlMatches = [];
            let urlMatch;
            while ((urlMatch = FONT_URL_REGEX.exec(compiledCss)) !== null) {
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
                    if (!fontRes.ok) {
                        console.error(`Failed to fetch font file: ${fontUrl} - HTTP ${fontRes.status}`);
                        continue;
                    }
                    const arrayBuffer = await fontRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    try {
                        fs.writeFileSync(localPath, buffer);
                    } catch (writeErr) {
                        console.error(`Failed to write font file to ${localPath}:`, writeErr);
                        continue;
                    }
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
        
        // Limit cache size to prevent memory issues in serverless environment
        const cacheKeys = Object.keys(outputCache);
        if (cacheKeys.length >= OUTPUT_CACHE_MAX_SIZE) {
            // Remove oldest entries
            const sortedKeys = cacheKeys.sort((a, b) => outputCache[a].timestamp - outputCache[b].timestamp);
            for (let i = 0; i < Math.floor(OUTPUT_CACHE_MAX_SIZE / 2); i++) {
                delete outputCache[sortedKeys[i]];
            }
        }

        // Canvas settings
        const w = Math.min(parseInt(q.w) || 800, 2000);
        const h = Math.min(parseInt(q.h) || 200, 2000);
        if (isNaN(w) || isNaN(h) || w < 10 || h < 10) throw new Error('Invalid dimensions');
        const radius = Math.min(parseInt(q.r) || 20, 200);
        
        // Background color validation
        let bg = q.bg || '#0f172a';
        if (bg !== 'transparent' && !HEX_COLOR_REGEX.test(bg)) {
            bg = '#0f172a';
        }

        // Parse layers preserving parameter order
        const allLayers = [];
        const imageUrlsToFetch = [];
        
        // Get raw query string to preserve parameter order
        const rawQuery = req.url.split('?')[1];
        if (rawQuery) {
            const paramPairs = rawQuery.split('&');
            let layerCount = 0;
            
            for (const pair of paramPairs) {
                if (layerCount >= 20) break; // Max 20 total layers
                
                const [key, value] = pair.split('=');
                if (!key || !value) continue;
                
                const decodedKey = decodeURIComponent(key);
                const decodedValue = decodeURIComponent(value);
                
                if (decodedKey === 'text') {
                    const parts = decodedValue.split(',');
                    if (!parts[0]) continue;
                    
                    let content = parts[0];
                    try { content = decodeURIComponent(content.replace(/\+/g, ' ')); } catch(e) { content = parts[0]; }
                    content = content.slice(0, 200);
                    
                    const x = parseFloat(parts[1]) || w / 2;
                    const y = parseFloat(parts[2]) || h / 2;
                    const fontSize = Math.min(parseFloat(parts[3]) || 36, 200);
                    
                    let color = parts[4] || '#ffffff';
                    if (!HEX_COLOR_REGEX.test(color)) {
                        color = '#ffffff';
                    }
                    
                    const rotation = parseFloat(parts[5]) || 0;
                    const anchor = ['start', 'middle', 'end'].includes(parts[6]) ? parts[6] : 'middle';
                    const fontFamily = (parts[7] || 'Arial').slice(0, 50);
                    
                    if (!isNaN(x) && !isNaN(y) && !isNaN(fontSize) && !isNaN(rotation)) {
                        allLayers.push({ type: 'text', content, x, y, fontSize, color, rotation, anchor, fontFamily });
                        layerCount++;
                    }
                } else if (decodedKey === 'image') {
                    const parts = decodedValue.split(',');
                    if (!parts[0]) continue;
                    
                    let url = parts[0];
                    try { url = decodeURIComponent(url.replace(/\+/g, ' ')); } catch(e) { url = parts[0]; }
                    url = url.slice(0, 1000);
                    
                    const x = parseFloat(parts[1]) || 10;
                    const y = parseFloat(parts[2]) || 10;
                    const width = parseFloat(parts[3]) || 60;
                    const height = parseFloat(parts[4]) || 60;
                    const rotation = parseFloat(parts[5]) || 0;
                    
                    if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height) && !isNaN(rotation)) {
                        allLayers.push({ type: 'image', url, x, y, width, height, rotation, needsFetch: url.startsWith('http') });
                        if (url.startsWith('http')) {
                            imageUrlsToFetch.push({ index: allLayers.length - 1, url });
                        }
                        layerCount++;
                    }
                }
            }
        }
        
        // Fetch external images in parallel for better performance
        if (imageUrlsToFetch.length > 0) {
            const fetchPromises = imageUrlsToFetch.map(async ({ index, url }) => {
                const base64Url = await getBase64Image(url);
                allLayers[index].url = base64Url;
            });
            await Promise.all(fetchPromises);
        }
        
        // Replace gitver patterns in text layers with actual versions
        for (const layer of allLayers) {
            if (layer.type === 'text') {
                layer.content = await replaceGitverPatterns(layer.content);
            }
        }

        // Don't reverse - params received as [bottom, ..., top] so top renders last (on top)

        // Fetch and inline all active fonts (for SVG output and Resvg backend paths)
        const fontFamilies = allLayers.filter(l => l.type === 'text').map(t => t.fontFamily);
        const { css: inlineFontsCss, paths: fontPaths } = await compileFonts(fontFamilies);
        
        // Check if any Google Fonts are actually being used
        const usesGoogleFonts = fontFamilies.some(font => GOOGLE_FONT_FILES[font]);

        // Build SVG
        let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
        
        // Embed Google Fonts inside CDATA block (only if Google Fonts are actually used)
        svg += `<defs><style><![CDATA[`;
        if (usesGoogleFonts && inlineFontsCss) {
            svg += inlineFontsCss;
        } else if (usesGoogleFonts) {
            // Fallback imports if server fetch is temporarily unavailable
            svg += `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');`;
            svg += `@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');`;
            svg += `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');`;
        }
        svg += `]]></style></defs>`;

        const fillBg = bg === 'transparent' ? 'none' : bg;
        svg += `<rect width="100%" height="100%" rx="${radius}" fill="${fillBg}"/>`;

        // Process layers in order (first = bottom, last = top, so top renders on top)
        for (const layer of allLayers) {
            if (layer.type === 'image') {
                const urlEscaped = escapeXml(layer.url);
                if (layer.rotation === 0) {
                    svg += `<image href="${urlEscaped}" xlink:href="${urlEscaped}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/>`;
                } else {
                    svg += `<g transform="translate(${layer.x},${layer.y}) rotate(${layer.rotation})"><image href="${urlEscaped}" xlink:href="${urlEscaped}" x="0" y="0" width="${layer.width}" height="${layer.height}"/></g>`;
                }
            } else if (layer.type === 'text') {
                const content = escapeXml(layer.content);
                if (!content) continue;
                let transform = '';
                if (layer.rotation !== 0) transform = ` transform="rotate(${layer.rotation} ${layer.x} ${layer.y})"`;
                
                // Build font-family stack with fallbacks for better compatibility
                const fontFamily = escapeXml(layer.fontFamily);
                let fontFamilyStack = fontFamily;
                
                // Add common fallbacks for better system font support
                const fallbackMap = {
                    'Arial': 'Arial, Helvetica, sans-serif',
                    'Helvetica': 'Helvetica, Arial, sans-serif',
                    'Times New Roman': 'Times New Roman, Times, serif',
                    'Georgia': 'Georgia, Times New Roman, serif',
                    'Courier New': 'Courier New, Courier, monospace',
                    'Verdana': 'Verdana, Arial, sans-serif'
                };
                
                if (fallbackMap[fontFamily]) {
                    fontFamilyStack = fallbackMap[fontFamily];
                }
                
                svg += `<text x="${layer.x}" y="${layer.y}" dy="0.35em" font-family="${fontFamilyStack}" font-size="${layer.fontSize}" fill="${layer.color}" text-anchor="${layer.anchor}"${transform}>${content}</text>`;
            }
        }
        svg += `</svg>`;

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