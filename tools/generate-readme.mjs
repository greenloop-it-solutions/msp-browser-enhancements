#!/usr/bin/env node
/**
 * Regenerates the script catalog section of README.md from the userscript
 * metadata blocks under scripts/.
 *
 * Usage:
 *   node tools/generate-readme.mjs          Rewrite the catalog in place.
 *   node tools/generate-readme.mjs --check  Exit nonzero if the catalog is stale.
 *
 * Only the region between the catalog markers is touched; the rest of README.md
 * is hand written.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REPOSITORY, REPOSITORY_ROOT, applicationLabel, loadUserscripts } from './lib/userscript.mjs';

const README_PATH = path.join(REPOSITORY_ROOT, 'README.md');
const START_MARKER = '<!-- BEGIN SCRIPT CATALOG -->';
const END_MARKER = '<!-- END SCRIPT CATALOG -->';

const checkOnly = process.argv.includes('--check');

function escapeTableCell(value) {
    return String(value ?? '').replaceAll('|', '\\|');
}

function renderScript(script) {
    const lines = [];
    const matchList = script.matches.length > 0 ? script.matches : ['(none declared)'];
    const grantList = script.grants.length > 0 ? script.grants : ['(none declared)'];

    lines.push(`#### ${script.name ?? script.fileName}`);
    lines.push('');
    lines.push(script.description ?? '_No description in metadata block._');
    lines.push('');
    lines.push('| | |');
    lines.push('| --- | --- |');
    lines.push(`| **Version** | \`${escapeTableCell(script.version ?? 'unknown')}\` |`);
    lines.push(
        `| **Matches** | ${matchList.map((value) => `\`${escapeTableCell(value)}\``).join('<br>')} |`
    );

    if (script.excludes.length > 0) {
        lines.push(
            `| **Excludes** | ${script.excludes
                .map((value) => `\`${escapeTableCell(value)}\``)
                .join('<br>')} |`
        );
    }

    lines.push(
        `| **Grants** | ${grantList.map((value) => `\`${escapeTableCell(value)}\``).join('<br>')} |`
    );

    if (script.runAt) {
        lines.push(`| **Runs at** | \`${escapeTableCell(script.runAt)}\` |`);
    }

    lines.push(`| **Source** | [${escapeTableCell(script.repositoryPath)}](${script.sourceUrl}) |`);
    lines.push('');
    lines.push(
        `**[Install ${script.name ?? script.fileName}](${script.expectedRawUrl})** — opens the Tampermonkey install prompt. Review the metadata block before confirming.`
    );
    lines.push('');

    return lines;
}

function renderCatalog(userscripts) {
    if (userscripts.length === 0) {
        return [
            '',
            '_No userscripts have been migrated into this repository yet._',
            ''
        ];
    }

    const byApplication = new Map();

    for (const script of userscripts) {
        const key = script.application ?? 'other';
        const group = byApplication.get(key) ?? [];
        group.push(script);
        byApplication.set(key, group);
    }

    const orderedKeys = Object.keys(REPOSITORY.applications).filter((key) =>
        byApplication.has(key)
    );

    for (const key of [...byApplication.keys()].sort()) {
        if (!orderedKeys.includes(key)) {
            orderedKeys.push(key);
        }
    }

    const lines = [''];

    for (const key of orderedKeys) {
        const group = byApplication
            .get(key)
            .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));

        lines.push(`### ${applicationLabel(key)}`);
        lines.push('');

        for (const script of group) {
            lines.push(...renderScript(script));
        }
    }

    return lines;
}

async function main() {
    const readme = await readFile(README_PATH, 'utf8');
    const startIndex = readme.indexOf(START_MARKER);
    const endIndex = readme.indexOf(END_MARKER);

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        process.stderr.write(
            `README.md must contain the ${START_MARKER} and ${END_MARKER} markers.\n`
        );
        process.exitCode = 1;
        return;
    }

    const userscripts = await loadUserscripts();
    const catalog = renderCatalog(userscripts).join('\n');

    const updated = `${readme.slice(0, startIndex + START_MARKER.length)}\n${catalog}\n${readme.slice(
        endIndex
    )}`;

    if (updated === readme) {
        process.stdout.write(`README catalog is current (${userscripts.length} userscript(s)).\n`);
        return;
    }

    if (checkOnly) {
        process.stderr.write(
            'README catalog is out of date. Run "npm run catalog" and commit the result.\n'
        );
        process.exitCode = 1;
        return;
    }

    await writeFile(README_PATH, updated, 'utf8');
    process.stdout.write(`README catalog regenerated (${userscripts.length} userscript(s)).\n`);
}

await main();
