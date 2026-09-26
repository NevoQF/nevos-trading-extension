# Verify a release

Each published version is tagged as `vX.Y.Z` and has a GitHub Release with the store zip files plus `SHA256SUMS.txt`.

Example: [v3.10.50](https://github.com/NevoQF/nevos-trading-extension/releases/tag/v3.10.50)

## What the tag means

`v3.10.50` points at the readable source in this repo for that version. The zip files on that release are the packages uploaded to [the website](https://nevos-extension.com) and submitted to browser stores.

## Check a zip

1. Download a zip from the GitHub Release, or from the website.
2. Hash it:

```powershell
Get-FileHash .\nevos-trading-extension-chrome-v3.10.50.zip -Algorithm SHA256
```

3. Compare that SHA-256 to the matching row in `SHA256SUMS.txt` on the same release.

The website zip and the GitHub zip for the same file name should match.

## Browser stores

Chrome, Edge, and other stores may re-wrap or re-sign a package after upload. A file taken from a store listing can hash differently from the zip we published here. Use the GitHub or website zip when you want a hash you can check.

## Source review

The files in `extension/` are the readable source for the tagged version. Release zips are minified build output of that source.
