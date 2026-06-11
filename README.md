<div align="center">

  ![Banner](http://banner-img.vercel.app/api/banner?w=500&h=100&r=20&bg=%23252525&image=https%253A%252F%252Fimages.jammable.com%252Fvoices%252Fsaiba-momoi-isGxI%252F2ab9d248-9b0f-4891-afd9-16c6b346a2ca.png%2C250%2C-30%2C250%2C250%2C0&text=Banner%2520Img%2C170%2C50%2C40%2C%23ff83d3%2C0%2Cmiddle%2CArial)

  # Banner Generator API

  A fast, serverless-optimized banner image generator with advanced caching and layer management. Perfect for dynamic social media images, OG tags, and more.

</div>

## Features

- Dynamic SVG/PNG Generation: Create banners on the fly with text and images
- Unified Layer System: Text and images in a single list with z-index control
- Layer Reordering: Move layers up/down with arrow buttons (top layer = rendered on top)
- Advanced Caching: ETags, CDN caching, font caching, and output caching
- Google Fonts Support: Inter, Fira Code, Playfair Display with smart fallbacks
- System Fonts: Arial, Helvetica, Georgia, Times New Roman, Courier New, Verdana with fallback chains
- Vercel Optimized: Ready for serverless deployment with built-in caching strategies
- URL Import/Export: Decode banner URLs to edit designs, share configurations via URL

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

**Layer Ordering**: Parameters are processed in order. The first layer parameter is rendered at the bottom, the last layer parameter is rendered on top.

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
image=https://picsum.photos/200,100,100,100,0&
text=Top Layer,600,200,40,%23ffffff,0,middle,Inter&
text=Bottom Layer,600,400,30,%23cccccc,0,middle,Arial&
bg=%231e3a8a&format=png
```

In this example:
- Image parameter is first, so it renders at the bottom
- "Top Layer" text renders on top of the image
- "Bottom Layer" text renders on top of everything (last parameter = top layer)

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

- **Unified Layer System**: Text and images in a single list with z-index control
- **Correct Layer Ordering**: Top layer in UI list = rendered on top in final image
- **Smart Caching**: ETags for conditional requests (304 responses), CDN caching (24 hours), output caching (1 hour), font caching (7 days)
- **Font Support**: System fonts + Google Fonts with automatic fallback chains
- **Parameter Order Preservation**: Maintains exact layer ordering from URL parameters

## Web Interface

The included web interface provides:

- **Visual Editor**: Real-time SVG preview as you edit
- **Unified Layer Management**: Add/remove text and image layers in a single list
- **Layer Reordering**: Move layers up/down with arrow buttons (top layer = rendered on top)
- **Export Options**: Download as PNG/SVG, copy URLs, copy Markdown, copy editor links
- **URL Decoder**: Paste any banner URL to import and edit all settings (canvas, text, image layers)
- **Shareable Links**: Generate editor links to share designs with others

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
