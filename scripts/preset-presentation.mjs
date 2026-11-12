import { escapeHtml, profileDetails } from "./site-components.mjs";

const labels = {
  dbFloor: "Level Floor",
  threeD: "3D",
  widthCssPx: "Width",
  persistenceMs: "Persistence",
  azimuthDeg: "Azimuth",
  elevationDeg: "Elevation",
  tpMaxMarker: "True Peak Max Marker",
  levelRangeDbfs: "Level Range",
  loudnessRangeLufs: "Loudness Range",
  levelRangeDb: "Level Range",
  msRatioRangeDb: "Mid/Side Ratio Range",
  monoLossFloorDb: "Mono Loss Floor",
  speedPercent: "Speed",
  tiltDbPerOctave: "Tilt",
  panelOpacityPercent: "Panel Opacity",
  surfaceOpacityPercent: "Surface Opacity",
  heightCssPx: "Height",
  preferredWidthCssPx: "Preferred Width",
  minHz: "Minimum Frequency",
  maxHz: "Maximum Frequency",
  windowSec: "Time Window",
  glassEnabled: "Glass",
  peakThresholdsDbfs: "Peak Thresholds",
  rmsThresholdsDbfs: "RMS Thresholds",
};
const names = {
  lr: "L/R",
  ms: "M/S",
  rms: "RMS",
  lissajous: "Lissajous",
  off: "Off",
  shortTerm: "Short-term",
};

const words = (key) =>
  labels[key] ??
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const unit = (key) =>
  /Dbfs$/.test(key)
    ? " dBFS"
    : /Lufs$/.test(key)
      ? " LUFS"
      : /DbPerOctave$/.test(key)
        ? " dB/oct"
        : /Db$/.test(key)
          ? " dB"
          : /Percent$/.test(key)
            ? "%"
            : /Hz$/.test(key)
              ? " Hz"
              : /Sec$/.test(key)
                ? " s"
                : /CssPx$/.test(key)
                  ? " px"
                  : "";
const display = (value, stats) =>
  typeof value === "boolean"
    ? value
      ? "On"
      : "Off"
    : typeof value === "number"
      ? String(value).replace("-", "−")
      : (stats[value]?.label ?? names[value] ?? words(String(value)));
const row = (label, value) =>
  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;

export function settingRows(settings, stats, prefix = "", inheritedUnit = "") {
  return Object.entries(settings ?? {})
    .map(([key, value]) => {
      const label = [prefix, words(key)].filter(Boolean).join(" · ");
      const suffix =
        (key === "dbFloor"
          ? " dB"
          : key.endsWith("Ms")
            ? " ms"
            : key.endsWith("Deg")
              ? "°"
              : unit(key)) || inheritedUnit;
      if (value === null) return row(label, "Not Set");
      if (Array.isArray(value))
        return row(
          label,
          value.length
            ? value.map((entry) => display(entry, stats)).join(", ")
            : "None",
        );
      if (typeof value === "object") {
        if (
          key === "channelPair" ||
          (key === "channel" && value.type === "pair")
        )
          return row(label, `Channels ${value.x + 1} / ${value.y + 1}`);
        if (key === "channel" && value.type === "single")
          return row(label, `Channel ${value.ch + 1}`);
        if (Object.keys(value).length === 2 && "min" in value && "max" in value)
          return row(
            label,
            `${display(value.min, stats)} to ${display(value.max, stats)}${suffix}`,
          );
        return settingRows(value, stats, label, suffix);
      }
      return row(
        label,
        `${display(value, stats)}${typeof value === "number" ? suffix : ""}`,
      );
    })
    .join("");
}

export function presetExtraDetails(preset, stats) {
  return (
    row("Loudness Profile", preset.profile?.name ?? "Off") +
    settingRows(preset.presentation, stats) +
    settingRows(preset.dockSettings, stats, "Dock")
  );
}

export function presetPanels(preset, { modules, stats }) {
  const { panels, profile } = preset;
  const titleFor = (panel) =>
    panel.title || modules[panel.moduleId] || panel.moduleId;
  const counts = new Map();
  for (const panel of panels) {
    const key = `${panel.location}:${titleFor(panel)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Map();
  const heading = (panel, location) => {
    const title = titleFor(panel);
    const key = `${location}:${title}`;
    const index = (seen.get(key) ?? 0) + 1;
    seen.set(key, index);
    const suffix = counts.get(key) > 1 ? ` ${index}` : "";
    const context = [location, panel.title ? modules[panel.moduleId] : ""]
      .filter(Boolean)
      .join(" · ");
    return `${escapeHtml(title + suffix)}${context ? ` <span>${escapeHtml(context)}</span>` : ""}`;
  };
  return `<section class="preset-settings"><h2>Panel Settings</h2><p class="muted">Settings saved in this file. Omitted controls use PLVS defaults.</p>
    ${panels.map((panel) => `<details class="preset-panel"><summary>${heading(panel, panel.location)}</summary><dl>${settingRows(panel.controls, stats)}${settingRows(panel.axes, stats, "Axes")}${panel.pinnedSize ? settingRows(panel.pinnedSize, stats, "Pinned Size") : ""}${panel.preferredWidthCssPx !== undefined ? settingRows({ preferredWidthCssPx: panel.preferredWidthCssPx }, stats) : ""}</dl>${Object.keys(panel.controls ?? {}).length || Object.keys(panel.axes ?? {}).length ? "" : "<p>Default panel settings.</p>"}</details>`).join("")}
    </section>${profile ? `<section class="preset-profile"><h2>Included Loudness Profile</h2><h3>${escapeHtml(profile.name)}</h3>${profileDetails(profile, stats)}</section>` : ""}`;
}
