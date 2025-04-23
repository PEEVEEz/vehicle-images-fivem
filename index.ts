import puppeteer from "puppeteer";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { Buffer } from "buffer";

// Create download folder
const folder = "./images";
if (!existsSync(folder)) {
  await mkdir(folder);
}

// Launch headless browser
const browser = await puppeteer.launch();
const page = await browser.newPage();

await page.goto(
  "https://docs.fivem.net/docs/game-references/vehicle-references/vehicle-models/",
  {
    waitUntil: "networkidle2",
  }
);

interface Vehicle {
  modelName: string;
  hash: string;
  image: string;
}

// Scrape vehicle data
const vehicles = await page.evaluate(() => {
  const data: Vehicle[] = [];

  document.querySelectorAll(".vehicle").forEach((vehicleEl) => {
    const image = vehicleEl.querySelector("img")?.src;
    const spans = vehicleEl.querySelectorAll(".vehicle-info span");

    let hash = "";
    let modelName = "";

    spans.forEach((span) => {
      const text = span.textContent || "";
      if (text.includes("Hash:")) {
        hash = text.replace("Hash:", "").trim();
      } else if (text.includes("Model Name:")) {
        modelName = text.replace("Model Name:", "").trim();
      }
    });

    if (image && hash && modelName) {
      data.push({
        modelName,
        hash,
        image: new URL(image, window.location.origin).href,
      });
    }
  });

  return data;
});

await browser.close();

// Download images
async function ensureDirectoryExists(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

for (const vehicle of vehicles) {
  const imageUrl = vehicle.image;

  const imagePathByHash = join("images", "hash", `${vehicle.hash}.webp`);
  const imagePathByName = join("images", "name", `${vehicle.modelName}.webp`);

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch ${imageUrl}`);

    const buffer = await res.arrayBuffer();

    await ensureDirectoryExists(imagePathByHash);
    await ensureDirectoryExists(imagePathByName);

    await writeFile(imagePathByHash, Buffer.from(buffer));
    await writeFile(imagePathByName, Buffer.from(buffer));

    console.log(`Downloaded and saved: ${imageUrl}`);
  } catch (err) {
    console.error(`Error downloading ${imageUrl}:`, err);
  }
}
