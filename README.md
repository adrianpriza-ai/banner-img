<div align="center">

  ![Banner](http://banner-img.vercel.app/api/banner?w=500&h=100&r=20&bg=%23ffffff&text=Banner%2520Img%2C170%2C50%2C41%2C%23000000%2C0%2Cmiddle%2CTimes+New+Roman%2Ctrue&image=https%253A%252F%252Fimages.jammable.com%252Fvoices%252Fsaiba-momoi-isGxI%252F2ab9d248-9b0f-4891-afd9-16c6b346a2ca.png%2C250%2C-30%2C250%2C250%2C0%2Ctrue&text=Banner%2520Img%2C170%2C50%2C40%2C%23ff83d3%2C0%2Cmiddle%2CTimes+New+Roman%2Ctrue)

  # Banner Generator API

  Generate banner images from URL parameters with text layers, image layers, custom fonts, and a built-in editor.

</div>

---

## Features

- Generate SVG or PNG banners from a single HTTP endpoint
- Stack multiple text and image layers in one banner
- Use the visual editor to build layouts and preview output
- Load supported Google Fonts with system font fallbacks
- Reuse generated output with caching and ETag support

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

### Choose Your Workflow

- Use the visual editor if you want to design a banner, tweak layers, and copy the generated URL.
- Use the API directly if you already know the parameters you want to send from code, scripts, or templates.

---

## Live Demo

This repo is deployed here, so you can try a working request immediately:

- https://banner-img.vercel.app/api/banner?w=1200&h=630&bg=%231e3a8a&text=Hello,600,315,60,%23ffffff,0,middle,Inter,true

Markdown image example:

![Demo Banner](https://banner-img.vercel.app/api/banner?w=1200&h=240&bg=%230f172a&text=Banner%20Img,600,120,72,%23ffffff,0,middle,Inter,true)

---

## How It Works

1. Set the canvas with `w`, `h`, `bg`, and optional `r`.
2. Add one or more `text` and `image` parameters.
3. Request `/api/banner` and receive an `svg` or `png`.

The API renders layers from left to right, so the first layer goes behind the next ones.

### Common Use Cases

- Open Graph and social preview images
- Project banners with title text and logos
- Dynamic images generated from app data
- Reusable templates driven by URL parameters

---

## API

Endpoint: `GET /api/banner`

Use repeated `text` and `image` parameters to build a composition.

When you are using this from GitHub or docs, replace the base URL with your own deployment (or use `http://localhost:3000` for local dev).

Minimal working request:

```http
https://banner-img.vercel.app/api/banner?w=1200&h=630&bg=%231e3a8a&text=Hello,600,315,60,%23ffffff,0,middle,Inter,true
```

If you are starting from the editor, build the banner visually first, then reuse the generated query string in your app or links.

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
Fields:
- `content`: text to render
- `x,y`: text position
- `size`: font size in pixels
- `color`: hex color
- `rotation`: rotation in degrees
- `anchor`: text anchor such as `start`, `middle`, or `end`
- `font`: font family name
- `clip`: `true` or `false`

Example: `text=Hello World,400,100,40,%23ffffff,0,middle,Arial,true`

### Image Layer Format
```text
image=url,x,y,width,height,rotation,clip
```
Fields:
- `url`: image URL
- `x,y`: image position
- `width,height`: rendered image size
- `rotation`: rotation in degrees
- `clip`: `true` or `false`

Example: `image=https://example.com/logo.png,50,50,100,100,0,true`

### Notes

- Layers are processed left to right: first is bottom, last is top.
- `format=svg` is the default; use `format=png` for raster output.
- `download=true` forces the browser to download the file.
- Fonts such as `Inter`, `Fira Code`, and `Playfair Display` are supported, with system fallbacks when needed.
- Requests from obvious bots/CLI tools may be blocked; if you test with curl, use a browser-like User-Agent.
- Advanced behavior (clipping details, gitver expansion, caching, bot protection) lives in [api/banner.js](api/banner.js).

Example curl (set a browser-like User-Agent):

```bash
curl -A "Mozilla/5.0" "https://banner-img.vercel.app/api/banner?w=1200&h=630&bg=%231e3a8a&text=Hello,600,315,60,%23ffffff,0,middle,Inter,true"
```

---

## Examples

### Simple Text Banner

```http
https://banner-img.vercel.app/api/banner?w=1200&h=630&text=Welcome,600,315,60,%23ffffff,0,middle,Inter,true&bg=%231e3a8a&format=png
```

### Text + Image Layers

```http
https://banner-img.vercel.app/api/banner?w=1200&h=630&image=https%3A%2F%2Fpicsum.photos%2F200,80,80,220,220,0,true&text=Top%20Layer,600,200,40,%23ffffff,0,middle,Inter,true&text=Bottom%20Layer,600,420,30,%23cccccc,0,middle,Arial,true&bg=%231e3a8a&format=png
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
