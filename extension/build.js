const esbuild = require("esbuild");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Parse .env manually (no extra deps needed)
function loadEnv(file) {
  const vars = {};
  if (!fs.existsSync(file)) return vars;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const env = loadEnv(path.join(__dirname, ".env"));
const isDev = process.argv.includes("--dev");
const outDir = isDev ? "build/chrome-mv3-dev" : "build/chrome-mv3-prod";

const define = {
  "process.env.EXT_SUPABASE_URL": JSON.stringify(
    env.EXT_SUPABASE_URL || ""
  ),
  "process.env.EXT_SUPABASE_ANON_KEY": JSON.stringify(
    env.EXT_SUPABASE_ANON_KEY || ""
  ),
};

async function main() {
  // Clean output dir before each build to remove stale artifacts
  fs.rmSync(outDir, { recursive: true, force: true });

  // Ensure output dirs
  fs.mkdirSync(`${outDir}/contents`, { recursive: true });
  fs.mkdirSync(`${outDir}/assets`, { recursive: true });

  const shared = {
    bundle: true,
    minify: !isDev,
    sourcemap: isDev ? "inline" : false,
    define,
    platform: "browser",
    target: ["chrome112"],
    format: "iife",
  };

  // Compile Tailwind CSS
  execSync(
    `npx tailwindcss -i style.css -o ${outDir}/popup.css --config tailwind.config.js`,
    { stdio: "inherit" }
  );

  // Background service worker
  await esbuild.build({
    ...shared,
    entryPoints: ["background.ts"],
    outfile: `${outDir}/background.js`,
  });

  // Popup (React)
  await esbuild.build({
    ...shared,
    entryPoints: ["popup.tsx"],
    outfile: `${outDir}/popup.js`,
    jsx: "automatic",
    loader: { ".css": "empty" },
  });

  // Content scripts
  for (const name of ["linkedin", "interceptor", "dashboard"]) {
    await esbuild.build({
      ...shared,
      entryPoints: [`contents/${name}.ts`],
      outfile: `${outDir}/contents/${name}.js`,
    });
  }

  // Copy static assets
  fs.copyFileSync("popup.html", `${outDir}/popup.html`);
  fs.copyFileSync("manifest.json", `${outDir}/manifest.json`);
  for (const f of fs.readdirSync("assets")) {
    fs.copyFileSync(`assets/${f}`, `${outDir}/assets/${f}`);
  }

  console.log(`\n✓ Build complete → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
