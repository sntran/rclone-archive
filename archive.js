#!/usr/bin/env npx rclone

const {
  basename,
  join,
} = require("path");

const { ZipFile } = require("yazl");

/**
 * Creates an archive from source path.
 * @param {object[]|string} source Source path or files output from `lsjson`.
 * @param {string} [target="-"] The optional target archive file, or to stdout.
 * @param {Object} [options={}] Optional flags.
 * @param {Boolean} [options.compress=false] Whether to compress the source.
 * @param {Boolean} [options.progress=false] Whether to show progress.
 * @param {Boolean} [options.dryRun=false] Dry-run.
 * @returns {Promise<object>} The resulting archive file.
 */
async function archive(source, target, options = {}) {
  const rclone = this;

  if (!target) {
    options = source;
  }

  if (!options) {
    options = target || {};
    target = "-";
  }

  const {
    compress = false,
    dryRun = false,
    progress = false,
    help = false,
  } = options;

  if (help) {
    const fs = require("fs").promises;
    const README = await fs.readFile(join(__dirname, "README.md"), "utf-8");
    process.stdout.write("\n" + README.substring(
      README.indexOf("`rclone archive`"),
      README.indexOf("## Installation")
    ));
    return;
  }

  let files = source;
  if (typeof source === "string") {
    files = JSON.parse(await rclone.promises.lsjson(source, {
      "recursive": true,
      "files-only": true,
      "mimetype": false,
    }));
  }

  let zipfile = new ZipFile();

  // Dry runs first to get the output size.
  files.forEach(({ Path, Size }, index) => {
    // Temporarily adds an empty directory so we can get the entry,
    // since `yazl` does not expose `Entry`.
    zipfile.addEmptyDirectory(Path);
    const entry = zipfile.entries[index];

    // Resets the entry name to remove the trailing slash added for directory.
    entry.utf8FileName = Buffer.from(Path);
    entry.isDirectory = false; // resets it back to file.
    entry.compress = compress; // to be explicit, even when a directory entry has no compression.
    entry.uncompressedSize = Size;
    entry.crcAndFileSizeKnown = false;
    // Puts back the modified entry for calculation.
    zipfile.entries[index] = entry;
  });

  const output = await new Promise((resolve, _reject) => {
    zipfile.end((size) => {
      resolve({
        Path: target,
        Name: basename(target),
        Size: size,
      });
    });
  });

  if (dryRun) {
    return output;
  }

  const { Size } = output;
  // Actual stream archive.
  zipfile = new ZipFile();

  zipfile.on("error", (error) => {
    process.stderr.write(error);
  });

  let outputStream = process.stdout;
  if (target !== "-") {
    const rcatOptions = {};

    // If the archive size could be computed,
    if (Size > -1) {
      // Sets size to preallocate the file in advance at the remote end and
      // actually stream it, even if remote backend doesn't support streaming.
      rcatOptions.size = Size;
    }

    if (progress) {
      rcatOptions.progress = true;
    }
    const rcat = rclone.rcat(target, rcatOptions);
    outputStream = rcat.stdin;
    if (progress) {
      rcat.stdout.on("data", (chunk) => {
        // Even though rclone's `rcat` outputs progress to `stdout`,
        // we write to `stderr` instead to keep it conformant.
        process.stderr.write(chunk);
      });
    }
  }

  outputStream.on("close", function() {
    // DONE.
  });

  zipfile.outputStream.pipe(outputStream);

  files.forEach(({ Path, Size, ModTime }) => {
    // Because `source` can be either of a folder or a file, we
    // remove the actual relative path of this file from `source`
    // to get the directory name.
    const fullPath = join(source.replace(Path, ""), Path);
    const fileStream = rclone.cat(fullPath).stdout;

    zipfile.addReadStream(fileStream, Path, {
      compress, // If true, the archive size is -1.
      size: Size, // Must set size here so the final archive size can be calculated.
      mtime: new Date(ModTime),
    });
  });

  return new Promise((resolve, reject) => {
    zipfile.end((_size) => {
      resolve(output);
    });
  });
}

module.exports = archive;
