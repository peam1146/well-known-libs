#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// --- Random utilities for seeded selection ---
function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomItems(items, count, seed) {
  const n = Math.max(0, Math.min(count, items.length));
  if (n === items.length && !seed) return items.slice();
  const rng = seed ? mulberry32(hashSeed(seed)) : Math.random;
  const shuffled = seed ? shuffleWithRng(items, rng) : items.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function imageToMarkdown(item, { large = true } = {}) {
  const sizeClass = item.sizeClass || (large ? "w-64" : "w-44 mt-6 opacity-85");
  const alt = item.alt || item.answer || "logo";
  return `<img src="${item.src}" alt="${escapeHtml(alt)}" class="${sizeClass} h-auto mx-auto" />`;
}

function textToMarkdown(item, { large = true } = {}) {
  const sizeClass = large ? "text-6xl" : "text-4xl mt-6 opacity-85";
  return `<div class="${sizeClass} font-bold">${escapeHtml(item.text ?? "")}</div>`;
}

function unitToMarkdown(it, opts) {
  const type = it.type || (it.src ? "image" : it.text ? "text" : "unsupported");
  if (type === "image") return imageToMarkdown(it, opts);
  if (type === "text") return textToMarkdown(it, opts);
  throw new Error('Only "image" and "text" types are supported');
}

function renderItemSlides(item) {
  const isGroup = Array.isArray(item.show);
  const showBig = isGroup
    ? `<div class="flex items-center justify-center flex-wrap gap-6">\n${item.show.map((s) => unitToMarkdown(s, { large: true })).join("\n")}\n</div>`
    : unitToMarkdown(item, { large: true });
  const showSmall = isGroup
    ? `<div class="flex items-center justify-center flex-wrap gap-6">\n${item.show.map((s) => unitToMarkdown(s, { large: false })).join("\n")}\n</div>`
    : unitToMarkdown(item, { large: false });

  const first = `---\nlayout: center\nclass: text-center\n---\n\n${showBig}\n`;
  const second = `---\nlayout: center\nclass: text-center\n---\n\n# ${escapeHtml(item.answer)}\n\n${showSmall}\n`;

  return `${first}\n${second}\n`;
}

function renderTitleSlide(title) {
  if (!title) return "";
  return `---\nlayout: center\nclass: text-center\n---\n\n# ${escapeHtml(title)}\n`;
}

function validateItem(i, item) {
  if (!item || typeof item !== "object") {
    throw new Error(`items[${i}] must be an object`);
  }
  if (!("answer" in item) || !item.answer) {
    throw new Error(`items[${i}] must have an "answer"`);
  }
  if (Array.isArray(item.show)) {
    if (item.show.length === 0)
      throw new Error(`items[${i}].show must not be empty`);
    for (const [j, sub] of item.show.entries()) {
      if (!sub || typeof sub !== "object")
        throw new Error(`items[${i}].show[${j}] must be an object`);
      const t = sub.type || (sub.src ? "image" : sub.text ? "text" : "unsupported");
      if (t === "image" && !sub.src)
        throw new Error(`items[${i}].show[${j}] type=image requires "src"`);
      if (t === "text" && (sub.text ?? "") === "")
        throw new Error(`items[${i}].show[${j}] type=text requires "text"`);
      if (t !== "image" && t !== "text")
        throw new Error(`items[${i}].show[${j}] only supports types: image, text`);
    }
    return;
  }
  const t = item.type || (item.src ? "image" : item.text ? "text" : "unsupported");
  if (t === "image") {
    if (!item.src) throw new Error(`items[${i}] type=image requires "src"`);
  } else if (t === "text") {
    if ((item.text ?? "") === "")
      throw new Error(`items[${i}] type=text requires "text"`);
  } else {
    throw new Error(`items[${i}] only supports types: image, text`);
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const inputPath = process.env.QUIZ_JSON
    ? path.resolve(projectRoot, process.env.QUIZ_JSON)
    : path.resolve(projectRoot, "quiz.json");
  const outDir = path.resolve(projectRoot, "pages");
  const outPath = path.resolve(outDir, "quiz.generated.md");

  try {
    const raw = await fs.readFile(inputPath, "utf8");
    const config = JSON.parse(raw);

    if (!Array.isArray(config.items)) {
      throw new Error('quiz.json must have an array field "items"');
    }

    // Determine selection count and seed
    const countRaw = process.env.QUIZ_COUNT ?? config.count ?? 15;
    const seed = process.env.QUIZ_SEED ?? config.seed ?? undefined;
    const countNum = Number(countRaw);
    if (!Number.isFinite(countNum) || countNum <= 0) {
      throw new Error(`Invalid quiz count: ${countRaw}`);
    }

    // Randomly pick N from the pool
    const selected = pickRandomItems(config.items, countNum, seed);

    const parts = [];

    // optional title slide
    if (config.title) parts.push(renderTitleSlide(config.title));

    for (const [i, item] of selected.entries()) {
      validateItem(i, item);
      parts.push(renderItemSlides(item));
    }

    const content = parts.join("\n");

    await ensureDir(outDir);
    await fs.writeFile(outPath, content, "utf8");

    console.log(
      `[quiz] Generated ${path.relative(projectRoot, outPath)} from ${path.relative(projectRoot, inputPath)} (picked ${selected.length}/${config.items.length}${seed ? `, seed=${seed}` : ""})`
    );
  } catch (e) {
    // Write a friendly placeholder so Slidev still runs
    await ensureDir(outDir);
    const fallback = `---\nlayout: center\nclass: text-center\n---\n\n# Quiz not ready\n\nUpdate quiz.json and re-run.\n\n<small>${e && e.message ? e.message : ""}</small>\n`;
    await fs.writeFile(
      path.resolve(outDir, "quiz.generated.md"),
      fallback,
      "utf8"
    );
    console.error("[quiz] Failed to generate from quiz.json:", e?.message || e);
    process.exitCode = 1;
  }
}

main();
