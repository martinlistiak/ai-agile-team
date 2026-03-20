/**
 * Regenerates favicon PNGs and logo-text.png from the favicon palette
 * (#FFFBF1 → #FFF2D0, black Instrument Serif). Requires: bun scripts/generate-brand-pngs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const fontPath = path.join(
  root,
  "node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff",
);
const fontData = fs.readFileSync(fontPath);

const fonts = [
  {
    name: "Instrument Serif",
    data: fontData,
    weight: 400,
    style: "normal",
  },
];

/** @param {string} svg */
function svgToPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  return resvg.render().asPng();
}

async function renderPng(element, width, height) {
  const svg = await satori(element, { width, height, fonts });
  return svgToPng(svg, width);
}

/** Rounded-square mark (matches public/favicon.svg proportions). */
function faviconElement(size) {
  const rx = Math.round((7 / 32) * size);
  const fontSize = Math.round((24 / 32) * size);
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #FFFBF1 0%, #FFF2D0 100%)",
        borderRadius: rx,
      },
      children: {
        type: "div",
        props: {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000000",
            fontSize,
            fontFamily: "Instrument Serif",
            lineHeight: 1,
            marginTop: Math.round(size * 0.06),
          },
          children: "R",
        },
      },
    },
  };
}

/** Transparent wordmark for raster contexts (meta tags, email, etc.). */
function wordmarkElement(width, height, fontSize) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      },
      children: {
        type: "div",
        props: {
          style: {
            color: "#000000",
            fontSize,
            fontFamily: "Instrument Serif",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          },
          children: "Runa",
        },
      },
    },
  };
}

async function main() {
  const fav32 = await renderPng(faviconElement(32), 32, 32);
  const fav256 = await renderPng(faviconElement(256), 256, 256);
  fs.writeFileSync(path.join(publicDir, "favicon-32.png"), fav32);
  fs.writeFileSync(path.join(publicDir, "favicon-256.png"), fav256);

  const textW = 560;
  const textH = 140;
  const textPng = await renderPng(
    wordmarkElement(textW, textH, 96),
    textW,
    textH,
  );
  fs.writeFileSync(path.join(publicDir, "logo-text.png"), textPng);

  console.log("Wrote public/favicon-32.png, favicon-256.png, logo-text.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
