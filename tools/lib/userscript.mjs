/**
 * Shared helpers for locating, parsing, and describing the userscripts in this
 * repository. Used by both the validator and the README catalog generator so
 * that the two tools can never disagree about metadata.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_DIRECTORY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const REPOSITORY_ROOT = path.dirname(TOOLS_DIRECTORY);

const packageJson = JSON.parse(
    await readFile(path.join(REPOSITORY_ROOT, 'package.json'), 'utf8')
);

export const REPOSITORY = packageJson.userscripts;

export const METADATA_FIELD_ORDER = [
    'name',
    'namespace',
    'version',
    'description',
    'author',
    'homepageURL',
    'supportURL',
    'updateURL',
    'downloadURL',
    'match',
    'exclude',
    'run-at',
    'grant'
];

export const REQUIRED_METADATA_FIELDS = [
    'name',
    'namespace',
    'version',
    'description',
    'match',
    'grant'
];

/** Metadata keys that must appear at most once in a metadata block. */
export const SINGULAR_METADATA_FIELDS = [
    'name',
    'namespace',
    'version',
    'description',
    'author',
    'homepageURL',
    'supportURL',
    'updateURL',
    'downloadURL',
    'run-at',
    'icon',
    'noframes'
];

const METADATA_BLOCK_PATTERN =
    /^[ \t]*\/\/[ \t]*==UserScript==[ \t]*$([\s\S]*?)^[ \t]*\/\/[ \t]*==\/UserScript==[ \t]*$/gm;

const METADATA_LINE_PATTERN = /^[ \t]*\/\/[ \t]*@([\w-]+)[ \t]*(.*?)[ \t]*$/;

/**
 * Recursively collect every file beneath `directory`, returning repository
 * relative POSIX paths so output is identical on Windows and Linux.
 */
export async function collectFiles(directory) {
    const found = [];
    let entries;

    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return found;
        }
        throw error;
    }

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            found.push(...(await collectFiles(absolutePath)));
        } else if (entry.isFile()) {
            found.push(absolutePath);
        }
    }

    return found;
}

export function toRepositoryPath(absolutePath) {
    return path.relative(REPOSITORY_ROOT, absolutePath).split(path.sep).join('/');
}

/**
 * Parse every userscript metadata block in `source`.
 * Returns one entry per block so the validator can detect duplicate blocks.
 */
export function parseMetadataBlocks(source) {
    const blocks = [];
    METADATA_BLOCK_PATTERN.lastIndex = 0;

    let match;
    while ((match = METADATA_BLOCK_PATTERN.exec(source)) !== null) {
        const body = match[1];
        const startLine = source.slice(0, match.index).split('\n').length;
        const fields = new Map();
        const unparsedLines = [];

        body.split('\n').forEach((line, offset) => {
            if (line.trim() === '') {
                return;
            }

            const fieldMatch = METADATA_LINE_PATTERN.exec(line);

            if (!fieldMatch) {
                unparsedLines.push({ line: startLine + offset + 1, text: line.trim() });
                return;
            }

            const [, key, rawValue] = fieldMatch;
            const values = fields.get(key) ?? [];
            values.push({ value: rawValue, line: startLine + offset + 1 });
            fields.set(key, values);
        });

        blocks.push({ startLine, fields, unparsedLines, text: match[0] });
    }

    return blocks;
}

/** First value for a metadata key, or undefined when absent. */
export function firstValue(block, key) {
    return block?.fields.get(key)?.[0]?.value;
}

/** All values for a metadata key. */
export function allValues(block, key) {
    return (block?.fields.get(key) ?? []).map((entry) => entry.value);
}

export function rawUrlFor(repositoryPath) {
    const { owner, repository, branch } = REPOSITORY;
    return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${repositoryPath}`;
}

export function sourceUrlFor(repositoryPath) {
    const { owner, repository, branch } = REPOSITORY;
    return `https://github.com/${owner}/${repository}/blob/${branch}/${repositoryPath}`;
}

export function applicationLabel(applicationKey) {
    return REPOSITORY.applications[applicationKey] ?? applicationKey;
}

/**
 * Load every `.user.js` file under the scripts directory, along with its parsed
 * metadata and derived URLs. Files that fail to parse are still returned so the
 * validator can report them.
 */
export async function loadUserscripts() {
    const scriptsDirectory = path.join(REPOSITORY_ROOT, REPOSITORY.scriptsDirectory);
    const files = await collectFiles(scriptsDirectory);

    const userscripts = [];

    for (const absolutePath of files.sort()) {
        if (!absolutePath.endsWith('.user.js')) {
            continue;
        }

        const repositoryPath = toRepositoryPath(absolutePath);
        const source = await readFile(absolutePath, 'utf8');
        const blocks = parseMetadataBlocks(source);
        const [block] = blocks;
        const segments = repositoryPath.split('/');

        userscripts.push({
            absolutePath,
            repositoryPath,
            fileName: segments.at(-1),
            application: segments.length >= 3 ? segments[1] : null,
            source,
            blocks,
            block,
            name: firstValue(block, 'name'),
            version: firstValue(block, 'version'),
            description: firstValue(block, 'description'),
            matches: allValues(block, 'match'),
            excludes: allValues(block, 'exclude'),
            grants: allValues(block, 'grant'),
            runAt: firstValue(block, 'run-at'),
            updateUrl: firstValue(block, 'updateURL'),
            downloadUrl: firstValue(block, 'downloadURL'),
            expectedRawUrl: rawUrlFor(repositoryPath),
            sourceUrl: sourceUrlFor(repositoryPath)
        });
    }

    return userscripts;
}

/** Non `.user.js` JavaScript files under scripts/, which the validator rejects. */
export async function findMisnamedScriptFiles() {
    const scriptsDirectory = path.join(REPOSITORY_ROOT, REPOSITORY.scriptsDirectory);
    const files = await collectFiles(scriptsDirectory);

    return files
        .filter((file) => file.endsWith('.js') && !file.endsWith('.user.js'))
        .map(toRepositoryPath);
}
