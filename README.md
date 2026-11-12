# PLVS Website

The source for the public [PLVS website](https://plvs.soundoer.com/). This repository owns
site templates, navigation, styles, published image assets, and HTML rendering. The
[PLVS product repository](https://github.com/SounDoer/PLVS) owns the user guide, reviewed
privacy policy, and Sharesets validation and compatibility rules.

## Build a candidate

Use Node from `.nvmrc` and run `npm ci`. Generate a website input bundle with
`scripts/export-website-inputs.mjs` in a PLVS checkout. The exporter takes clean checkouts
at the chosen product, Catalogue, and privacy revisions. For example, from PLVS:

```sh
node scripts/export-website-inputs.mjs <stable-checkout> <new-input-directory>
```

In this repository, run:

```sh
npm run check -- <input-directory>
```

The result is a complete static site in `artifacts/website/`. The input manifest records
the source commits. The site reads the exported guide, reviewed policy body, Catalogue
presentation data, and validated assets. The build itself can run with only the bundle
and this checkout.

CI exports inputs from the exact initial live baseline, PLVS v0.26.0, and uploads a
reviewable candidate. Production deployment still uses the existing PLVS Pages workflow
while the new build and the handoff of the immutable Catalogue history are verified.
