# rclone-archive

`rclone archive` stores and compress a remote path to an archive in
another remote path.

By default, the source path is stored only, without any compression.
The archive is streamed to destination remote.

    npx rclone archive source:path dest:filename.zip

If `--compress` is set, content is compressed first.

    npx rclone archive source:path dest:filename.zip --compress

Note that with compression, the archive file size cannot be determined
beforehand, so it cannot be streamed to the destination, but uploaded
in chunks.

In either cases, the archive process cannot be retried because the data
are not kept around until the archiving succeeds. If you need to
transfer a lot of data, you're better off archiving locally and then
`rclone move` the archive to the destination.

## Usage

    npx rclone archive source:path dest:filename.zip

Flags:

    --compress  Deflate the content (compression method 8)
    --help      Help for `archive`
    --progress  Shows progress.

## Installation

Since this is just a custom command, [`rclone.js`](https://rclone.js.org/)
needs to be installed first.

    npm install rclone.js rclone-archive
