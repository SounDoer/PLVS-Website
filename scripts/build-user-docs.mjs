import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { Marked } from "marked";

import { siteNavigation } from "./site-components.mjs";

/**
 * Renders the Markdown user guide in `docs/user/` into the website's docs page. The Markdown is the
 * source; `website/docs/template.html` only supplies the page around it. Chapter order comes from
 * the numbered list under "## Chapters" in `docs/user/README.md`.
 *
 */

const TEMPLATE = join("website", "docs", "template.html");
const TROUBLESHOOTING_PATH = "/docs/troubleshooting/";

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** @returns {{ slug: string, file: string, title: string }[]} */
export function readChapters(guideDirectory) {
  const index = readFileSync(join(guideDirectory, "README.md"), "utf8");
  const section = index.split(/^## Chapters$/m)[1]?.split(/^## /m)[0] ?? "";
  const chapters = [...section.matchAll(/^\d+\. \[([^\]]+)\]\(([^)]+\.md)\)$/gm)].map(
    ([, title, file]) => ({
      slug: basename(file, ".md"),
      file,
      title,
    }),
  );
  const files = readdirSync(guideDirectory).filter(
    (name) => name.endsWith(".md") && !["README.md", "cli.md"].includes(name),
  );
  if (chapters.length !== files.length || files.some((file) =>
    chapters.filter((chapter) => chapter.file === file).length !== 1)) {
    throw new Error("The guide index must list every chapter exactly once");
  }
  return chapters;
}

/**
 * A chapter's `# Title` becomes the section heading and every heading below it moves down one
 * level. Heading ids carry the chapter slug, because chapters share headings such as "Limits".
 */
export function renderChapter(markdown, slug, chapterSlugs, productSha, standalone = false) {
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        if (standalone && depth === 1) return "";
        const text = this.parser.parseInline(tokens);
        if (depth === 1) return `<h2>${text}</h2>\n`;
        const level = Math.min(depth + (standalone ? 0 : 1), 6);
        return `<h${level} id="${slug}-${slugify(text)}">${text}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<a href="${escapeHtml(resolveHref(href, chapterSlugs, productSha, slug))}"${titleAttr}>${text}</a>`;
      },
    },
  });
  return `<section class="docs-section" id="${slug}">\n${marked.parse(markdown)}</section>`;
}

function resolveHref(href, chapterSlugs, productSha, slug) {
  const match = /^([^/:#]+)\.md(?:#(.+))?$/.exec(href);
  if (!match) return href;
  const [, name, fragment] = match;
  if (name === "troubleshooting" && chapterSlugs.includes(name)) {
    return TROUBLESHOOTING_PATH + (fragment ? `#${fragment}` : "");
  }
  if (chapterSlugs.includes(name)) {
    const base = slug === "troubleshooting" ? "/docs/" : "";
    return base + (fragment ? `#${name}-${fragment}` : `#${name}`);
  }
  return `https://github.com/SounDoer/PLVS/blob/${productSha}/docs/user/${name}.md${fragment ? `#${fragment}` : ""}`;
}

export function buildDocsPage({ root, guideDirectory, productSha, troubleshooting = false }) {
  const chapters = readChapters(guideDirectory);
  const slugs = chapters.map((chapter) => chapter.slug);
  if (troubleshooting && !slugs.includes("troubleshooting")) return null;
  const sidebar = chapters
    .map(({ slug, title }) => {
      if (slug === "troubleshooting") {
        const active = troubleshooting ? ' class="active" aria-current="page"' : "";
        return `<a href="${TROUBLESHOOTING_PATH}"${active}>${escapeHtml(title)}</a>`;
      }
      return `<a href="${troubleshooting ? "/docs/" : ""}#${slug}">${escapeHtml(title)}</a>`;
    })
    .join("\n        ");
  const content = chapters
    .filter(({ slug }) => (slug === "troubleshooting") === troubleshooting)
    .map(({ slug, file }) =>
      renderChapter(
        readFileSync(join(guideDirectory, file), "utf8"),
        slug,
        slugs,
        productSha,
        troubleshooting,
      ),
    )
    .join("\n");
  const template = readFileSync(join(root, TEMPLATE), "utf8");
  return (troubleshooting
    ? template
        .replace("<title>PLVS Docs</title>", "<title>PLVS Troubleshooting</title>")
        .replace(
          "How to use PLVS: signal sources, meter panels, workspace, and settings.",
          "Fix common PLVS audio capture and measurement issues.",
        )
        .replace("<h1>Docs</h1>", "<h1>Troubleshooting</h1>")
        .replace(
          "Get started with PLVS and explore its sources, meters, and workspace.",
          "Find steps for the message shown in Status.",
        )
    : template)
    .replace(
      "<!-- SITE_NAVIGATION -->",
      siteNavigation("docs").replace(
        '<a href="/sharesets/">Sharesets</a>',
        '<!-- SHARESETS_NAV_START --><a href="/sharesets/">Sharesets</a><!-- SHARESETS_NAV_END -->',
      ),
    )
    .replace("<!-- USER_DOCS_SIDEBAR -->", sidebar)
    .replace("<!-- USER_DOCS_CONTENT -->", content);
}
