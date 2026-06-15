<div align="center">

  ![Banner](http://banner-img.vercel.app/api/banner?w=500&h=100&r=20&bg=%23ffffff&text=Banner%2520Img%2C170%2C50%2C41%2C%23000000%2C0%2Cmiddle%2CTimes+New+Roman%2Ctrue&image=https%253A%252F%252Fimages.jammable.com%252Fvoices%252Fsaiba-momoi-isGxI%252F2ab9d248-9b0f-4891-afd9-16c6b346a2ca.png%2C250%2C-30%2C250%2C250%2C0%2Ctrue&text=Banner%2520Img%2C170%2C50%2C40%2C%23ff83d3%2C0%2Cmiddle%2CTimes+New+Roman%2Ctrue)

  # Banner Generator API

  A serverless banner image generator (SVG/PNG) with text/image overlays and a simple web editor.

</div>

---

## Features

- Dynamic SVG/PNG generation via a single HTTP endpoint
- Layered rendering for multiple text and image overlays
- Visual web editor for building banners and previewing parameters
- Caching and ETag support for faster repeated renders
- Google Fonts + system font fallbacks

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

## API

Endpoint: `GET /api/banner`

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
text=content,x,y,size,color,rotation,anchor,font,clip
```
*Example*: `text=Hello World,400,100,40,%23ffffff,0,middle,Arial,true`

### Image Layer Format
```text
image=url,x,y,width,height,rotation,clip
```
*Example*: `image=https://example.com/logo.png,50,50,100,100,0,true`

Layer ordering: layers are processed left to right (first is bottom, last is top).

Advanced behavior (clipping details, gitver expansion, caching, bot protection) lives in [api/banner.js](api/banner.js).

---

## Examples

```http
/api/banner?w=1200&h=630&text=Welcome,600,315,60,%23ffffff,0,middle,Inter&bg=%231e3a8a&format=png
```

```http
/api/banner?w=1200&h=630&image=https://picsum.photos/200,100,100,100,0&text=Top Layer,600,200,40,%23ffffff,0,middle,Inter&text=Bottom Layer,600,400,30,%23cccccc,0,middle,Arial&bg=%231e3a8a&format=png
```

---

## Development

### Directory Structure
```text
banner-img/
├── api/
│   └── banner.js
├── public/
│   └── index.html
├── package.json
├── vercel.json
└── README.md
```

### Performance & Configuration
- PNG encoding uses `@resvg/resvg-js`
- Serverless runtime settings live in `vercel.json`

---

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome. Feel free to submit issues and pull requests.
