# Quiz Slides (Slidev + Bun)

This project generates a quiz deck for [Slidev](https://sli.dev) from a JSON config.

## Quick start

- `bun install`
- `bun run dev`
- visit <http://localhost:3030>

The dev/build pipeline auto-generates slides from `quiz.json`.

## How it works

- Configure your quiz in `quiz.json`.
- Run `bun run generate` to produce `pages/quiz.generated.md` (done automatically before `dev`, `build`, and `export`).
- We run Slidev with the generated file directly, so the demo `slides.md` is not used at runtime.

## Commands

- `bun run dev` — start Slidev using `pages/quiz.generated.md`.
- `bun run build` — build the deck.
- `bun run export` — export to PDF/PNG.
- `bun run generate` — regenerate slides from `quiz.json`.

## JSON format

`quiz.json` supports text, image, and stacked groups (image/text only):

- Text: `{ "type": "text", "text": "TS", "answer": "TypeScript" }`
- Image: `{ "type": "image", "src": "https://vitejs.dev/logo.svg", "answer": "Vite" }`
- Group: `{ "show": [ {"type":"image","src":"https://api.iconify.design/logos/vue.svg"}, {"type":"image","src":"https://api.iconify.design/logos/vitejs.svg"} ], "answer": "Vue + Vite" }`

Note: The `icon` type has been removed. Use images instead (you can use Iconify CDN URLs like `https://api.iconify.design/<collection>/<name>.svg`).

Each item generates two slides: the prompt, then the answer.
