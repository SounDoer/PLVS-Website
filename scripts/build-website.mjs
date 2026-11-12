import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { buildSharesetsSite } from "./build-sharesets-site.mjs";
import { buildDocsPage } from "./build-user-docs.mjs";
import {
  assertSafeWebsiteOutput,
  validateWebsite,
} from "./validate-website.mjs";

async function removeSourceOnlyFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeSourceOnlyFiles(path);
    else if (entry.isFile() && entry.name.includes(".test.")) await rm(path);
  }
}

async function renameWithRetry(source, target) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      if (
        !new Set(["EACCES", "EBUSY", "EPERM"]).has(error?.code) ||
        attempt === 7
      )
        throw error;
      await delay(40 * (attempt + 1));
    }
  }
}

async function replaceDirectory(staging, output) {
  const backup = join(
    dirname(output),
    `.${basename(output)}-backup-${process.pid}-${Date.now()}`,
  );
  let movedPrevious = false;
  try {
    await renameWithRetry(output, backup);
    movedPrevious = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await renameWithRetry(staging, output);
  } catch (error) {
    if (movedPrevious) await renameWithRetry(backup, output);
    throw error;
  }
  if (movedPrevious) await rm(backup, { recursive: true, force: true });
}

export function pinHomepageRelease(html, { productVersion, releaseAssets }) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(productVersion)) {
    throw new Error("Expected a stable PLVS product version");
  }
  const tag = `v${productVersion}`;
  const keys = {
    mac: "macosDmg",
    winInstall: "windowsInstaller",
    winPortable: "windowsPortable",
    linux: "linuxDeb",
  };
  const urls = Object.fromEntries(
    Object.entries(keys).map(([platform, key]) => {
      const name = releaseAssets?.[key];
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name ?? "")) {
        throw new Error(`Missing or invalid release asset ${key}`);
      }
      return [
        platform,
        `https://github.com/SounDoer/PLVS/releases/download/${tag}/${name}`,
      ];
    }),
  );
  const placeholder = "/* PLVS_RELEASE */ null";
  if (html.split(placeholder).length !== 2) {
    throw new Error("Expected exactly one homepage release placeholder");
  }
  return html.replace(placeholder, () => JSON.stringify({ tag, urls }));
}

export async function buildWebsite({
  rootDirectory,
  inputDirectory,
  outputDirectory,
}) {
  const root = resolve(rootDirectory ?? process.cwd());
  const website = resolve(root, "website");
  const inputs = resolve(inputDirectory);
  const manifest = JSON.parse(
    await readFile(join(inputs, "manifest.json"), "utf8"),
  );
  if (
    manifest.schemaVersion !== 1 ||
    !["productSha", "policySha", "contentSha"].every((key) =>
      /^[a-f0-9]{40}$/.test(manifest[key]),
    ) ||
    !manifest.modules ||
    !manifest.stats ||
    !Array.isArray(manifest.listings)
  ) {
    throw new Error("Expected a version 1 PLVS website input bundle");
  }
  const guideDirectory = join(inputs, "guide");
  const catalogueDirectory = join(inputs, "catalogue");
  const output = assertSafeWebsiteOutput(
    outputDirectory ?? join(root, "artifacts", "website"),
    [website, inputs],
    { repositoryRoot: root, localOutputRoot: join(root, "artifacts") },
  );
  const staging = join(
    dirname(output),
    `.${basename(output)}-staging-${process.pid}-${Date.now()}`,
  );

  await mkdir(dirname(output), { recursive: true });
  await rm(staging, { recursive: true, force: true });
  try {
    await cp(website, staging, { recursive: true });
    await removeSourceOnlyFiles(staging);
    const homepage = join(staging, "index.html");
    await writeFile(
      homepage,
      pinHomepageRelease(await readFile(homepage, "utf8"), manifest),
    );
    await mkdir(join(staging, "docs"), { recursive: true });
    await writeFile(
      join(staging, "docs", "index.html"),
      buildDocsPage({ root, guideDirectory, productSha: manifest.productSha }),
    );
    const policyPage = join(staging, "privacy", "index.html");
    const policyTemplate = await readFile(policyPage, "utf8");
    const policyBody = await readFile(join(inputs, "policy.html"), "utf8");
    const policyPlaceholder = "<!-- PRIVACY_POLICY -->";
    if (
      policyTemplate.split(policyPlaceholder).length !== 2 ||
      !/^<main\b[^>]*>[\s\S]*<\/main>$/.test(policyBody)
    ) {
      throw new Error("Privacy page requires exactly one reviewed policy body");
    }
    await writeFile(
      policyPage,
      policyTemplate.replace(policyPlaceholder, () => policyBody),
    );
    await buildSharesetsSite({
      catalogueDirectory,
      manifest,
      outputDirectory: join(staging, "sharesets"),
      siteDirectory: staging,
      websiteDirectory: website,
    });
    await rm(join(staging, "docs", "template.html"));
    const validation = await validateWebsite(staging);
    await replaceDirectory(staging, output);
    return { outputDirectory: output, ...validation, root: output };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main(args) {
  if (args.length < 1 || args.length > 2) {
    throw new Error(
      "Usage: npm run build -- <PLVS-input-directory> [output-directory]",
    );
  }
  const result = await buildWebsite({
    inputDirectory: args[0],
    outputDirectory: args[1],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
