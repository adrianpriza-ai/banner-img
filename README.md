<div align="center">

  ![Banner](https://banner-img.vercel.app/api/banner?w=500&h=100&r=20&bg=%23ffffff&text=Banner%2520Img%2C170%2C51%2C41%2C%23000000%2C0%2Cmiddle%2CTimes+New+Roman&image=https%253A%252F%252Fimages.jammable.com%252Fvoices%252Fsaiba-momoi-isGxI%252F2ab9d248-9b0f-4891-afd9-16c6b346a2ca.png%2C250%2C-30%2C250%2C250%2C0&text=Banner%2520Img%2C170%2C50%2C40%2C%23ff83d3%2C0%2Cmiddle%2CTimes+New+Roman)

  # Banner Generator API

  A fast, serverless-optimized banner image generator with dynamic rendering and advanced caching. Open Graph (OG) tags, and dynamic text or image overlays.

</div>

---

## Features

- **Dynamic SVG/PNG Generation**: Create banners on the fly combining text and images.
- **Unified Layer System**: Text and image layers handled in a single layout stack.
- **Visual Web Editor**: Built-in interface to design banners, reorder layers, and preview live.
- **Advanced Caching**: Edge CDN caching (24 hours), ETag support (304 replies), and persistent font loading.
- **Google Fonts Support**: Integration with Google Fonts (Inter, Fira Code, Playfair Display) and standard system fonts with automatic fallbacks.
- **URL Configuration Sync**: Share designs or restore the editor state via URL parameters.

---

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
Open `http://localhost:3000` to access the visual web editor.

---

## API Reference

### Banner Generation Endpoint
`GET /api/banner`

### Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `w` / `h` | Integer | `800` / `200` | Canvas width and height in pixels (Max: `2000`) |
| `r` | Integer | `20` | Border radius in pixels (Max: `200`) |
| `bg` | String | `transparent` | Background color (URL-encoded Hex or `transparent`) |
| `text` | String | (Optional) | Text layer definitions (can be specified multiple times) |
| `image` | String | (Optional) | Image layer definitions (can be specified multiple times) |
| `format` | String | `svg` | Output format: `svg` or `png` |
| `download` | Boolean | `false` | Force file download |

### Text Layer Format
```text
text=content,x,y,size,color,rotation,anchor,font
```
*Example*: `text=Hello World,400,100,40,%23ffffff,0,middle,Arial`

### Image Layer Format
```text
image=url,x,y,width,height,rotation
```
*Example*: `image=https://example.com/logo.png,50,50,100,100,0`

*Layer Ordering*: Layers are processed from left to right. The first layer parameter is rendered at the bottom, and the last layer parameter is rendered on top.

### GitHub Version Badge in Text
You can include GitHub release versions directly in text layers using the `[gitver/owner/repo]` syntax. The API will automatically fetch and replace the pattern with the latest version tag.

**Example:**
```
text=New [gitver/adrianpriza-ai/banner-img] Released,600,315,40,#ffffff,0,middle,Inter
```

This will fetch the latest release version from the specified GitHub repository and display it in the banner. The version is cached for 5 minutes to avoid excessive API calls.

**Notes:**
- Uses GitHub's public API (rate limited)
- If the API fails or repository is not found, the original `[gitver/owner/repo]` pattern will be displayed
- You can use multiple gitver patterns in a single text layer
- Works with both SVG and PNG output formats

---

## Examples

### Simple Text Banner
```http
/api/banner?w=1200&h=630&text=Welcome,600,315,60,%23ffffff,0,middle,Inter&bg=%231e3a8a&format=png
```

### Multi-Layer Composition
```http
/api/banner?w=1200&h=630&image=https://picsum.photos/200,100,100,100,0&text=Top Layer,600,200,40,%23ffffff,0,middle,Inter&text=Bottom Layer,600,400,30,%23cccccc,0,middle,Arial&bg=%231e3a8a&format=png
```

---

## Development

### Directory Structure
```text
banner-img/
├── api/
│   └── banner.js          # Main API endpoint with caching, rendering logic, and gitver support
├── public/
│   └── index.html         # Frontend visual web editor
├── package.json           # Project metadata & dependencies
├── vercel.json            # Edge routing, custom headers, and function memory config
└── README.md              # Project documentation
```

### Performance & Configuration
- **Optimization**: Powered by Rust-backed `@resvg/resvg-js` for high-performance PNG encoding.
- **Serverless**: Configured via `vercel.json` with `1024MB` memory and a `10s` timeout.

---

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome. Feel free to submit issues and pull requests.
