import { unzipSync } from "fflate";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import path from "node:path";

const PARTS = [
  ["1-KsfXz30pc3cy-k7zFsl5YHHIuxUZQOw", "water-colors-originals-part-1.zip"],
  ["10vBBhmZ8c_3ENxziSxdK_o5bzX24rUTW", "water-colors-originals-part-2.zip"],
  ["1EPflkZ5FOUc3zImFkqGRbFB6Y7-Fe4Yx", "water-colors-originals-part-3.zip"],
];

async function loadIdeas() {
  const ideas = [];
  for (let part = 1; part <= 4; part++) {
    const source = await readFile(`water-colors-ideas/data/ideas-${part}.js`, "utf8");
    const match = source.match(/const a=(\[.*?\]);a\.forEach/s);
    if (!match) throw new Error(`Could not parse ideas-${part}.js`);
    ideas.push(...JSON.parse(match[1]));
  }
  return ideas;
}

const IDEAS = await loadIdeas();
const IMAGE_FILES = JSON.parse(await readFile("image-map.json", "utf8"));

async function download(id) {
  const urls = [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
  ];
  let last;
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1_000_000) throw new Error(`Download suspiciously small: ${bytes.length}`);
      return bytes;
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });

for (const [id, name] of PARTS) {
  console.log("Downloading", name);
  const archive = unzipSync(await download(id));
  for (const [fileName, bytes] of Object.entries(archive)) {
    if (fileName.endsWith("/")) continue;
    const destination = path.join("dist", fileName);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}

if (IDEAS.length !== IMAGE_FILES.length) {
  throw new Error(`Idea/image mismatch: ${IDEAS.length}/${IMAGE_FILES.length}`);
}
const payload = IDEAS.map((idea, index) => ({
  ...idea,
  image: `assets/${IMAGE_FILES[index]}`,
}));

await writeFile("dist/ideas.json", JSON.stringify(payload, null, 2), "utf8");
await writeFile("dist/index.html", await readFile("site-template.html", "utf8"), "utf8");
console.log(`Built ${payload.length} ideas with ${new Set(IMAGE_FILES).size} original images`);
