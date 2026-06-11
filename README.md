<div align="center">

  # Banner Generator API

  A fast, serverless-optimized banner image generator with advanced caching and layer management. Perfect for dynamic social media images, OG tags, and more.

</div>

## Features

- Dynamic SVG/PNG Generation: Create banners on the fly with text and images
- Layer Management: Unified layer system with reordering support
- Advanced Caching: ETags, CDN caching, font caching, and output caching
- Vercel Optimized: Ready for serverless deployment with built-in caching strategies

## Quick Start

### Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/adrianpriza-ai/banner-img)

### Local Development

```bash
git clone https://github.com/adrianpriza-ai/banner-img
cd banner-img
npm install
npx vercel dev
```

Visit `http://localhost:3000` for the web interface.

## Usage

### API Endpoint

```
/api/banner?w=800&h=200&bg=%230f172a&text=Hello+World&format=png
```

### Parameters

| Parameter | Description | Max/Default |
|-----------|-------------|-------------|
| w | Width | 2000px / 800 |
| h | Height | 2000px / 200 |
| r | Border radius | 200px / 20 |
| bg | Background color | Hex or transparent |
| text | Text layers | Comma-separated (see below) |
| image | Image layers | Comma-separated (see below) |
| format | Output format | svg or png |
| download | Force download | true or false |

### Text Layer Format

```
text=content,x,y,size,color,rotation,anchor,font
```

Example: `text=Hello World,400,100,40,%23ffffff,0,middle,Arial` (Note: Hex colors must be URL-encoded, e.g., `#ffffff` as `%23ffffff`)

### Image Layer Format

```
image=url,x,y,width,height,rotation
```

Example: `image=https://example.com/logo.png,50,50,100,100,0`

## Examples

### Simple Text Banner

```
/api/banner?w=1200&h=630&text=Welcome,600,315,60,%23ffffff,0,middle,Inter&bg=%231e3a8a&format=png
```

### Text + Image Banner

```
/api/banner?w=1200&h=630&text=My Banner,600,300,50,%23ffffff,0,middle,Arial&image=https://picsum.photos/200,100,50,50,0&bg=%230f172a&format=png
```

### Multiple Layers

```
/api/banner?w=1200&h=630&
text=Top Layer,600,200,40,%23ffffff,0,middle,Inter&
text=Bottom Layer,600,400,30,%23cccccc,0,middle,Arial&
image=https://picsum.photos/200,100,100,100,0&
bg=%231e3a8a&format=png
```

### Markdown Usage

```markdown
![Banner](https://banner-img.vercel.app/api/banner?w=1200&h=630&text=Hello+World&format=png)
```

## Development

### Project Structure

```
banner-img/
├── api/
│   └── banner.js          # Main API endpoint with caching
├── public/
│   └── index.html         # Web interface with layer management
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
└── README.md              # This file
```

### Key Features

- Unified Layer System: Text and images in a single list with z-index control
- Smart Caching: ETags for conditional requests (304 responses), CDN caching (24 hours), output caching (1 hour), font caching (7 days)
- Font Support: System fonts + Google Fonts with automatic fallbacks
- Layer Reordering: Move layers up/down to control rendering order

## Web Interface

The included web interface provides:

- Visual Editor: Real-time banner preview
- Layer Management: Add/remove/reorder text and image layers
- Export Options: Download as PNG/SVG, copy URLs, copy Markdown
- URL Decoder: Import existing banner configurations

## Performance

- First request: Full processing (~500-1000ms)
- Cached requests: 10-100x faster (~5-50ms)
- Edge caching: Served from nearest Vercel CDN location
- Font persistence: No repeated downloads across function invocations

## Configuration

The `vercel.json` file includes optimized settings:

- 1024MB memory allocation
- 10-second function timeout
- CDN caching headers
- API route optimization

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Feel free to submit issues and pull requests.
