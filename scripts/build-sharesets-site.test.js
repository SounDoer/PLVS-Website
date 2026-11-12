import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import { buildSharesetsSite } from "./build-sharesets-site.mjs";

it("retains original and revised preview paths while rendering the latest revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "plvs-site-preview-"));
  try {
    const outputDirectory = join(root, "site");
    await writeFile(join(root, "original.png"), "original");
    await writeFile(join(root, "revision.png"), "revision");
    const id = "product-workspace-file";
    const listing = {
      id: "theme",
      slug: "theme",
      type: "themes",
      title: "Example Theme",
      summary: "Example",
      descriptionMarkdown: "Example",
      tags: [],
      references: [],
      releases: [],
      included: {
        metadata: { facets: {}, dependencies: [], content: { summary: {} } },
        previews: [{ id, path: "original.png" }],
        previewRevisions: [{ number: 1, previews: [{ id, path: "revision.png" }] }],
      },
    };
    await buildSharesetsSite({
      catalogueDirectory: root,
      outputDirectory,
      manifest: { listings: [listing], modules: {}, stats: {} },
    });
    const filePath = "files/theme/included";
    expect(await readFile(join(outputDirectory, "themes/theme/index.html"), "utf8"))
      .toContain(`/sharesets/${filePath}/previews/r1/${id}.png`);
    expect(await readFile(join(outputDirectory, filePath, `${id}.png`), "utf8")).toBe("original");
    expect(await readFile(join(outputDirectory, filePath, "previews/r1", `${id}.png`), "utf8"))
      .toBe("revision");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
