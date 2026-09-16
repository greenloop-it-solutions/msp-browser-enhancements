#!/usr/bin/env node
/**
 * Builds a Tampermonkey import package containing every userscript in this
 * repository, for Tampermonkey's Utilities -> Import from file.
 *
 * The format is the one Tampermonkey's own Utilities -> Export writes: a JSON
 * document with base64-encoded script sources. It was derived from a real
 * export produced by Tampermonkey (backup format "version": "1"). Nothing here
 * is decompiled or guessed at -- every field mirrors a field that appears in a
 * genuine export, and anything optional is omitted rather than invented.
 *
 * IMPORTANT: the backup format is Tampermonkey's own and is versioned. If a
 * future Tampermonkey release moves to a different backup version, this package
 * may stop importing cleanly. The per-script raw URLs in the README always work.
 *
 * Each entry sets `file_url` to the script's permanent raw URL and
 * `check_for_updates: true`, so scripts installed from this package keep
 * updating from GitHub exactly as if they had been installed individually.
 *
 * Usage:
 *   node tools/build-import-package.mjs            Write dist/ artifacts.
 *   node tools/build-import-package.mjs --print-tag  Print the release tag only.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REPOSITORY, REPOSITORY_ROOT, loadUserscripts } from './lib/userscript.mjs';

const DIST_DIRECTORY = path.join(REPOSITORY_ROOT, 'dist');

const PACKAGE_FILE_NAME = `${REPOSITORY.repository}-tampermonkey-import.txt`;
const MANIFEST_FILE_NAME = 'package-manifest.json';

/**
 * Tampermonkey's backup schema version, copied from a real export. Bump only
 * after confirming against a fresh export from the Tampermonkey version in use.
 */
const BACKUP_FORMAT_VERSION = '1';

/** Fixed namespace so a given script path always derives the same UUID. */
const UUID_NAMESPACE = '6f1c8a52-7a2e-4c3d-9b6f-2d4e5a7c9b10';

const printTagOnly = process.argv.includes('--print-tag');

/** RFC 4122 version 5 UUID, so rebuilds are byte-for-byte reproducible. */
function deterministicUuid(name) {
    const namespaceBytes = Buffer.from(UUID_NAMESPACE.replaceAll('-', ''), 'hex');
    const digest = createHash('sha1')
        .update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')]))
        .digest();

    const bytes = Buffer.from(digest.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20)
    ].join('-');
}

/**
 * Per-script options block, mirroring a genuine Tampermonkey export. The
 * `override.orig_*` fields record what the metadata block declared, which is how
 * Tampermonkey detects that a later update changed a script's matches or grants.
 */
function buildOptions(script) {
    return {
        check_for_updates: true,
        comment: null,
        compat_foreach: false,
        compat_metadata: false,
        compat_powerful_this: null,
        compat_wrappedjsobject: false,
        compatopts_for_requires: true,
        noframes: null,
        override: {
            merge_connects: true,
            merge_excludes: true,
            merge_includes: true,
            merge_matches: true,
            orig_connects: [],
            orig_excludes: [...script.excludes],
            orig_includes: [],
            orig_matches: [...script.matches],
            orig_noframes: null,
            orig_run_at: script.runAt ?? null,
            orig_run_in: [],
            orig_tags: [],
            use_blockers: [],
            use_connects: [],
            use_excludes: [],
            use_includes: [],
            use_matches: []
        },
        run_at: null,
        run_in: null,
        sandbox: null,
        tags: [],
        unwrap: null,
        user_modified: null
    };
}

function buildPackage(userscripts, timestampMs) {
    return {
        created_by: 'Tampermonkey',
        version: BACKUP_FORMAT_VERSION,
        scripts: userscripts.map((script, index) => ({
            name: script.name,
            options: buildOptions(script),
            storage: {
                ts: timestampMs,
                // Always empty. Real script storage from a browser profile must
                // never be published -- it can hold tokens and customer data.
                data: {}
            },
            enabled: true,
            position: index + 1,
            file_url: script.expectedRawUrl,
            uuid: deterministicUuid(script.repositoryPath),
            source: Buffer.from(script.source, 'utf8').toString('base64')
        }))
    };
}

/**
 * Short hash of every script name and version. The release tag is derived from
 * this, so a commit that does not change any @version produces the tag that is
 * already released and the workflow skips it.
 */
function catalogHash(userscripts) {
    const fingerprint = userscripts
        .map((script) => `${script.name}@${script.version}`)
        .sort()
        .join('\n');

    return createHash('sha256').update(fingerprint, 'utf8').digest('hex').slice(0, 8);
}

async function main() {
    const userscripts = (await loadUserscripts()).sort((left, right) =>
        left.repositoryPath.localeCompare(right.repositoryPath)
    );

    if (userscripts.length === 0) {
        process.stderr.write('No userscripts found; nothing to package.\n');
        process.exitCode = 1;
        return;
    }

    const hash = catalogHash(userscripts);
    const tag = `pkg-${hash}`;

    if (printTagOnly) {
        process.stdout.write(`${tag}\n`);
        return;
    }

    // Fixed timestamp derived from the catalog, so repeated builds of the same
    // scripts produce byte-identical output.
    const timestampMs = Number.parseInt(hash, 16) * 1000;

    const importPackage = buildPackage(userscripts, timestampMs);

    await mkdir(DIST_DIRECTORY, { recursive: true });

    const packagePath = path.join(DIST_DIRECTORY, PACKAGE_FILE_NAME);
    await writeFile(packagePath, `${JSON.stringify(importPackage)}\n`, 'utf8');

    const manifest = {
        tag,
        generatedFrom: `${REPOSITORY.owner}/${REPOSITORY.repository}@${REPOSITORY.branch}`,
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        scriptCount: userscripts.length,
        scripts: userscripts.map((script) => ({
            name: script.name,
            version: script.version,
            path: script.repositoryPath,
            rawUrl: script.expectedRawUrl
        }))
    };

    await writeFile(
        path.join(DIST_DIRECTORY, MANIFEST_FILE_NAME),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );

    process.stdout.write(`Wrote ${path.relative(REPOSITORY_ROOT, packagePath)}\n`);
    process.stdout.write(`Release tag: ${tag}\n`);
    for (const script of manifest.scripts) {
        process.stdout.write(`  - ${script.name} ${script.version}\n`);
    }
}

await main();
