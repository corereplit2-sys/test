import fs from "node:fs";
import path from "node:path";

let envLoaded = false;

export function loadEnv(envFile = ".env") {
  if (envLoaded) return;

  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    envLoaded = true;
    return;
  }

  const contents = fs.readFileSync(envPath, "utf8");

  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || key in process.env) {
      return;
    }

    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const unquoted = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = unquoted;
  });

  envLoaded = true;
}

loadEnv();
