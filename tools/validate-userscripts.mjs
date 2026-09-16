#!/usr/bin/env node
/**
 * Validates every `.user.js` file in this repository against the conventions
 * documented in CLAUDE.md and docs/development.md.
 *
 * Exits with a nonzero status when any error is reported.
 */

import vm from 'node:vm';

import {
    REPOSITORY,
    REQUIRED_METADATA_FIELDS,
    SINGULAR_METADATA_FIELDS,
    allValues,
    findMisnamedScriptFiles,
    firstValue,
    loadUserscripts
} from './lib/userscript.mjs';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const KEBAB_CASE_FILE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\.user\.js$/;

/**
 * Placeholder tokens that indicate metadata was templated but never filled in.
 * Matched case sensitively so ordinary words are not flagged.
 */
const PLACEHOLDER_TOKENS = [
    'YOURORG',
    'YOUR_ORG',
    'YOURNAME',
    'YOUR_NAME',
    'OWNER',
    'REPOSITORY',
    'REPO_NAME',
    'CHANGEME',
    'CHANGE_ME',
    'TODO_URL',
    'example.com'
];

/** Match patterns that are too broad to allow without explicit approval. */
const BROAD_MATCH_PATTERNS = [
    '*://*/*',
    'http*://*/*',
    '*://*',
    'http://*/*',
    'https://*/*',
    '*',
    '<all_urls>'
];

const SECRET_PATTERNS = [
    { label: 'GitHub token', pattern: /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
    { label: 'AWS access key id', pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { label: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
    { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { label: 'JSON web token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
    { label: 'private key block', pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
    { label: 'Authorization header literal', pattern: /["'`]\s*(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{16,}\s*["'`]/i },
    {
        label: 'hard-coded credential assignment',
        pattern:
            /\b(api[_-]?key|apikey|secret|password|passwd|client[_-]?secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer[_-]?token)\b\s*[:=]\s*["'`][^"'`\s]{12,}["'`]/i
    }
];

const CONSOLE_CALL_PATTERN = /\bconsole\s*\.\s*(log|debug|info|warn|error|trace|table|dir)\s*\(/g;
const ALLOW_CONSOLE_MARKER = '/* allow-console */';

const findings = [];

function report(severity, file, message, line) {
    findings.push({ severity, file, message, line });
}

function error(file, message, line) {
    report('error', file, message, line);
}

function warn(file, message, line) {
    report('warning', file, message, line);
}

function lineNumberOf(source, index) {
    return source.slice(0, index).split('\n').length;
}

/**
 * Strip line comments, block comments, and string/template literal contents so
 * heuristic scans do not fire on documentation or on sample text. Characters
 * are replaced with spaces to preserve offsets for line number reporting.
 */
function blankNonCode(source) {
    const characters = [...source];
    const length = characters.length;
    let index = 0;
    let state = 'code';
    let quote = '';

    const blank = (from, to) => {
        for (let position = from; position < to; position += 1) {
            if (characters[position] !== '\n') {
                characters[position] = ' ';
            }
        }
    };

    while (index < length) {
        const current = source[index];
        const next = source[index + 1];

        if (state === 'code') {
            if (current === '/' && next === '/') {
                const end = source.indexOf('\n', index);
                const stop = end === -1 ? length : end;
                blank(index, stop);
                index = stop;
                continue;
            }
            if (current === '/' && next === '*') {
                const end = source.indexOf('*/', index + 2);
                const stop = end === -1 ? length : end + 2;
                blank(index, stop);
                index = stop;
                continue;
            }
            if (current === '"' || current === "'" || current === '`') {
                state = 'string';
                quote = current;
                index += 1;
                continue;
            }
            index += 1;
            continue;
        }

        // Inside a string or template literal.
        if (current === '\\') {
            blank(index, Math.min(index + 2, length));
            index += 2;
            continue;
        }
        if (current === quote) {
            state = 'code';
            quote = '';
            index += 1;
            continue;
        }
        blank(index, index + 1);
        index += 1;
    }

    return characters.join('');
}

/** Source ranges of the canonical debug logging helper, where console use is expected. */
function debugHelperRanges(source) {
    const ranges = [];
    const declarationPattern = /(?:function\s+debugLog\s*\(|(?:const|let|var)\s+debugLog\s*=)/g;

    let match;
    while ((match = declarationPattern.exec(source)) !== null) {
        const lineEnd = source.indexOf('\n', match.index);
        const declarationEnd = lineEnd === -1 ? source.length : lineEnd;
        const openBrace = source.indexOf('{', match.index);

        // A concise arrow body has no brace on the declaration line, for example
        // `const debugLog = (...args) => CONFIG.debug && console.debug(...args);`.
        // Without this bound the search would latch onto some later unrelated
        // brace and silently whitelist everything in between.
        if (openBrace === -1 || openBrace > declarationEnd) {
            ranges.push([match.index, declarationEnd]);
            continue;
        }

        let depth = 0;
        let end = source.length;

        for (let position = openBrace; position < source.length; position += 1) {
            if (source[position] === '{') {
                depth += 1;
            } else if (source[position] === '}') {
                depth -= 1;
                if (depth === 0) {
                    end = position + 1;
                    break;
                }
            }
        }

        ranges.push([match.index, end]);
    }

    return ranges;
}

function validateFileName(script) {
    if (!KEBAB_CASE_FILE_PATTERN.test(script.fileName)) {
        error(
            script.repositoryPath,
            `File name "${script.fileName}" must be lowercase kebab-case ending in .user.js`
        );
    }

    if (!script.application) {
        error(
            script.repositoryPath,
            `Userscripts must live in ${REPOSITORY.scriptsDirectory}/<application>/<script>.user.js`
        );
        return;
    }

    if (!Object.hasOwn(REPOSITORY.applications, script.application)) {
        warn(
            script.repositoryPath,
            `Application directory "${script.application}" is not listed in package.json userscripts.applications`
        );
    }
}

function validateMetadataBlock(script) {
    if (script.blocks.length === 0) {
        error(script.repositoryPath, 'No // ==UserScript== metadata block found');
        return false;
    }

    if (script.blocks.length > 1) {
        error(
            script.repositoryPath,
            `Found ${script.blocks.length} metadata blocks; exactly one is allowed`,
            script.blocks[1].startLine
        );
    }

    for (const unparsed of script.block.unparsedLines) {
        error(
            script.repositoryPath,
            `Unrecognized line inside metadata block: ${unparsed.text}`,
            unparsed.line
        );
    }

    return true;
}

function validateRequiredFields(script) {
    for (const field of REQUIRED_METADATA_FIELDS) {
        if (!script.block.fields.has(field)) {
            error(script.repositoryPath, `Missing required metadata field @${field}`);
            continue;
        }

        const empty = script.block.fields
            .get(field)
            .filter((entry) => entry.value.trim() === '');

        for (const entry of empty) {
            error(script.repositoryPath, `Metadata field @${field} has no value`, entry.line);
        }
    }
}

function validateSingularFields(script) {
    for (const field of SINGULAR_METADATA_FIELDS) {
        const entries = script.block.fields.get(field);

        if (entries && entries.length > 1) {
            error(
                script.repositoryPath,
                `Metadata field @${field} appears ${entries.length} times but must appear once`,
                entries[1].line
            );
        }
    }
}

/**
 * Every script shares one @namespace. Tampermonkey identifies an installed
 * script by name plus namespace, so a drifting namespace silently turns an
 * update into a second, parallel installation.
 */
function validateNamespace(script) {
    const namespace = firstValue(script.block, 'namespace');

    if (namespace !== undefined && namespace !== REPOSITORY.namespace) {
        error(
            script.repositoryPath,
            `@namespace must be ${REPOSITORY.namespace} but is ${namespace}`
        );
    }
}

/** Attribution is repository-wide, not per script. */
function validateAuthor(script) {
    const author = firstValue(script.block, 'author');

    if (author !== undefined && author !== REPOSITORY.author) {
        error(script.repositoryPath, `@author must be ${REPOSITORY.author} but is ${author}`);
    }
}

function validateVersion(script) {
    const version = firstValue(script.block, 'version');

    if (version !== undefined && !VERSION_PATTERN.test(version)) {
        error(
            script.repositoryPath,
            `@version "${version}" must use three numeric components, for example 1.0.0`
        );
    }
}

function validateMatches(script) {
    const matches = allValues(script.block, 'match');

    if (matches.length === 0) {
        error(script.repositoryPath, 'At least one @match entry is required');
    }

    for (const matchPattern of matches) {
        if (BROAD_MATCH_PATTERNS.includes(matchPattern)) {
            error(
                script.repositoryPath,
                `@match "${matchPattern}" is too broad; scope the script to the pages it enhances`
            );
            continue;
        }

        const hostMatch = /^[^:]+:\/\/([^/]*)/.exec(matchPattern);

        if (!hostMatch) {
            warn(script.repositoryPath, `@match "${matchPattern}" is not a recognizable match pattern`);
            continue;
        }

        const host = hostMatch[1];

        if (host === '*' || host === '') {
            error(script.repositoryPath, `@match "${matchPattern}" matches every host`);
        } else if (/^\*\.[^.]+$/.test(host)) {
            warn(
                script.repositoryPath,
                `@match "${matchPattern}" wildcards an entire top level domain`
            );
        }
    }
}

function validateGrants(script) {
    const grants = allValues(script.block, 'grant');

    if (grants.length === 0) {
        // validateRequiredFields() already reported the missing field.
        return;
    }

    if (grants.includes('none') && grants.length > 1) {
        error(script.repositoryPath, '@grant none cannot be combined with other grants');
    }
}

function validateUpdateUrls(script) {
    const updateUrl = firstValue(script.block, 'updateURL');
    const downloadUrl = firstValue(script.block, 'downloadURL');

    if (!updateUrl) {
        error(script.repositoryPath, 'Missing @updateURL');
    }

    if (!downloadUrl) {
        error(script.repositoryPath, 'Missing @downloadURL');
    }

    if (updateUrl && downloadUrl && updateUrl !== downloadUrl) {
        error(script.repositoryPath, '@updateURL and @downloadURL must be identical');
    }

    for (const [field, url] of [
        ['updateURL', updateUrl],
        ['downloadURL', downloadUrl]
    ]) {
        if (url && url !== script.expectedRawUrl) {
            error(
                script.repositoryPath,
                `@${field} must be ${script.expectedRawUrl} but is ${url}`
            );
        }
    }

    if (!firstValue(script.block, 'homepageURL')) {
        warn(script.repositoryPath, 'Missing @homepageURL');
    }

    if (!firstValue(script.block, 'supportURL')) {
        warn(script.repositoryPath, 'Missing @supportURL');
    }
}

function validatePlaceholders(script) {
    script.source.split('\n').forEach((text, offset) => {
        for (const token of PLACEHOLDER_TOKENS) {
            if (text.includes(token)) {
                error(script.repositoryPath, `Unreplaced placeholder "${token}" found`, offset + 1);
            }
        }
    });
}

function validateSecrets(script) {
    for (const { label, pattern } of SECRET_PATTERNS) {
        const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
        const scanner = new RegExp(pattern.source, flags);

        let match;
        while ((match = scanner.exec(script.source)) !== null) {
            error(
                script.repositoryPath,
                `Possible ${label} committed in source`,
                lineNumberOf(script.source, match.index)
            );
        }
    }
}

function validateDebugStatements(script) {
    const code = blankNonCode(script.source);
    const allowedRanges = debugHelperRanges(code);
    const lines = script.source.split('\n');

    CONSOLE_CALL_PATTERN.lastIndex = 0;

    let match;
    while ((match = CONSOLE_CALL_PATTERN.exec(code)) !== null) {
        const index = match.index;

        if (allowedRanges.some(([start, end]) => index >= start && index < end)) {
            continue;
        }

        const line = lineNumberOf(script.source, index);

        if (lines[line - 1]?.includes(ALLOW_CONSOLE_MARKER)) {
            continue;
        }

        error(
            script.repositoryPath,
            `Unconditional console.${match[1]}() call; route diagnostics through debugLog() or annotate the line with ${ALLOW_CONSOLE_MARKER}`,
            line
        );
    }

    const debuggerPattern = /\bdebugger\b/g;
    while ((match = debuggerPattern.exec(code)) !== null) {
        error(
            script.repositoryPath,
            'debugger statement left in source',
            lineNumberOf(script.source, match.index)
        );
    }
}

function validateSyntax(script) {
    try {
        new vm.Script(script.source, { filename: script.repositoryPath });
    } catch (syntaxError) {
        error(script.repositoryPath, `Syntax error: ${syntaxError.message}`);
    }
}

function validateUniqueNames(userscripts) {
    const byName = new Map();

    for (const script of userscripts) {
        if (!script.name) {
            continue;
        }

        const existing = byName.get(script.name) ?? [];
        existing.push(script.repositoryPath);
        byName.set(script.name, existing);
    }

    for (const [name, paths] of byName) {
        if (paths.length > 1) {
            error(paths[1], `@name "${name}" is also used by ${paths[0]}`);
        }
    }
}

async function main() {
    const userscripts = await loadUserscripts();
    const misnamed = await findMisnamedScriptFiles();

    for (const repositoryPath of misnamed) {
        error(repositoryPath, 'JavaScript files under scripts/ must use the .user.js extension');
    }

    for (const script of userscripts) {
        validateFileName(script);
        validateSyntax(script);
        validatePlaceholders(script);
        validateSecrets(script);
        validateDebugStatements(script);

        if (!validateMetadataBlock(script)) {
            continue;
        }

        validateRequiredFields(script);
        validateSingularFields(script);
        validateNamespace(script);
        validateAuthor(script);
        validateVersion(script);
        validateMatches(script);
        validateGrants(script);
        validateUpdateUrls(script);
    }

    validateUniqueNames(userscripts);

    const errors = findings.filter((finding) => finding.severity === 'error');
    const warnings = findings.filter((finding) => finding.severity === 'warning');

    for (const finding of findings) {
        const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
        process.stdout.write(`${finding.severity.toUpperCase()} ${location} - ${finding.message}\n`);
    }

    if (userscripts.length === 0) {
        process.stdout.write('No userscripts found yet; nothing to validate.\n');
    }

    process.stdout.write(
        `\nChecked ${userscripts.length} userscript(s): ${errors.length} error(s), ${warnings.length} warning(s).\n`
    );

    if (errors.length > 0) {
        process.exitCode = 1;
    }
}

await main();
