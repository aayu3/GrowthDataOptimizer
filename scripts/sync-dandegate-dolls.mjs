#!/usr/bin/env node

/**
 * Discover dolls from Dandegate, download missing portraits, and fill only
 * missing remolding fields in src/data/dolls.json. Existing data is never
 * replaced, so review the resulting diff and make intentional corrections
 * manually when Dandegate changes existing data.
 *
 * Usage:
 *   npm run sync:dolls
 *   npm run sync:dolls -- --dry-run
 *   npm run sync:dolls -- --refresh-images
 */

import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOLLS_PATH = path.join(ROOT, 'src/data/dolls.json');
const RELIC_INFO_PATH = path.join(ROOT, 'src/data/relicinfo.json');
const IMAGE_DIR = path.join(ROOT, 'src/assets/doll_images');
const SITE = 'https://dandegate.net';
const API = 'https://api.dandegate.net/api';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const refreshImages = args.has('--refresh-images');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function slugFor(name) {
    // Dandegate uses lowercase, hyphen-separated slugs (e.g. Mosin-Nagant).
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function extractJsonObject(html, marker) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) throw new Error(`Could not find ${marker} in the page.`);

    const start = html.indexOf('{', markerIndex + marker.length);
    if (start === -1) throw new Error(`Could not find JSON after ${marker}.`);

    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < html.length; index += 1) {
        const char = html[index];
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
            continue;
        }
        if (char === '"') quoted = true;
        else if (char === '{') depth += 1;
        else if (char === '}' && --depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
    throw new Error(`Unterminated JSON after ${marker}.`);
}

function textFromHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchOrThrow(url, accept = 'text/html') {
    const response = await fetch(url, {
        headers: {
            Accept: accept,
            'User-Agent': 'GrowthDataOptimizer/1.0 (portrait and remolding sync)'
        }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response;
}

async function fetchRemolding(name) {
    const url = `${SITE}/dolls/${slugFor(name)}/remolding`;
    const html = await (await fetchOrThrow(url)).text();
    const remolding = extractJsonObject(html, '"remoldingPattern":');
    const avatarUrl = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
        ?? remolding.doll?.avatarUrl;
    if (!avatarUrl) throw new Error(`No portrait URL found for ${name}.`);
    return { avatarUrl, remolding };
}

function hasValues(value) {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function fillMissingRemoldingData(remolding, existing = {}) {
    const allowed_slots = Object.fromEntries(
        Object.entries(remolding.coreSlots ?? {})
            .filter(([, count]) => Number(count) > 0)
            .map(([slot, count]) => [slot[0].toUpperCase() + slot.slice(1), count])
    );
    const currentByTier = new Map((existing.bonuses ?? []).map(bonus => [bonus.tier, bonus]));
    const sourceBonuses = (remolding.imagoforms ?? []).map((form, index) => {
        const tier = index + 1;
        const prior = currentByTier.get(tier) ?? {};
        const requirements = Object.fromEntries(
            ['bulwark', 'support', 'sentinel', 'vanguard']
                .map(slot => [slot, Number(form[`${slot}Factors`]) || 0])
                .filter(([, count]) => count > 0)
                .map(([slot, count]) => [slot[0].toUpperCase() + slot.slice(1), count])
        );

        // Do not overwrite curated Buff mappings or existing source values.
        // Only source description and slot requirements when they are absent.
        const next = { ...prior, tier };
        if (!next.description) next.description = textFromHtml(form.effect ?? '');
        for (const [slot, count] of Object.entries(requirements)) {
            if (next[slot] == null) next[slot] = count;
        }
        return next;
    });

    const next = { ...existing };
    if (!next.element && remolding.doll?.phase) next.element = remolding.doll.phase;
    if (!hasValues(next.allowed_slots) && hasValues(allowed_slots)) next.allowed_slots = allowed_slots;

    // Preserve existing bonus order; add only tiers that do not yet exist.
    const bonuses = [...(next.bonuses ?? [])];
    for (const sourceBonus of sourceBonuses) {
        const existingIndex = bonuses.findIndex(bonus => bonus.tier === sourceBonus.tier);
        if (existingIndex === -1) bonuses.push(sourceBonus);
        else bonuses[existingIndex] = sourceBonus;
    }
    if (!hasValues(next.bonuses) && bonuses.length > 0) next.bonuses = bonuses;
    else if (JSON.stringify(bonuses) !== JSON.stringify(next.bonuses)) next.bonuses = bonuses;
    return next;
}

async function fetchDollIndex() {
    const response = await fetchOrThrow(`${API}/dolls?limit=100`, 'application/json');
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.data)) throw new Error('Dandegate returned an invalid dolls list.');
    return payload.data.filter(doll => doll.name && !doll.preview);
}

async function exists(file) {
    try {
        await stat(file);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

async function downloadPortrait(name, url) {
    const output = path.join(IMAGE_DIR, `${name}.webp`);
    if (!refreshImages && await exists(output)) return false;
    if (dryRun) return true;

    const response = await fetchOrThrow(url, 'image/webp,image/*;q=0.8');
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`Portrait is not an image (${type}).`);

    const temporary = `${output}.download`;
    await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
    try {
        await rename(temporary, output);
    } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
    }
    return true;
}

async function writeJson(file, value) {
    if (!dryRun) await writeFile(file, `${JSON.stringify(value, null, 4)}\n`);
}

const dolls = JSON.parse(await readFile(DOLLS_PATH, 'utf8'));
const relicInfo = JSON.parse(await readFile(RELIC_INFO_PATH, 'utf8'));
await mkdir(IMAGE_DIR, { recursive: true });

let metadataChanges = 0;
let portraitChanges = 0;
let discoveredDolls = 0;
const failures = [];

let dandegateDolls = [];
try {
    dandegateDolls = await fetchDollIndex();
    for (const doll of dandegateDolls) {
        if (!(doll.name in dolls)) {
            dolls[doll.name] = {};
            discoveredDolls += 1;
            console.log(`+ Discovered ${doll.name}`);
        }
    }
} catch (error) {
    failures.push(`Doll discovery: ${error.message}`);
    console.error(`✗ Doll discovery: ${error.message}`);
}
const dandegateByName = new Map(dandegateDolls.map(doll => [doll.name, doll]));

for (const name of Object.keys(dolls).sort((left, right) => left.localeCompare(right))) {
    try {
        const { avatarUrl, remolding } = await fetchRemolding(name);
        const next = fillMissingRemoldingData(remolding, dolls[name]);
        if (JSON.stringify(next) !== JSON.stringify(dolls[name])) {
            dolls[name] = next;
            metadataChanges += 1;
        }
        if (await downloadPortrait(name, dandegateByName.get(name)?.avatarUrl ?? avatarUrl)) portraitChanges += 1;
        console.log(`✓ ${name}`);
    } catch (error) {
        failures.push(`${name}: ${error.message}`);
        console.error(`✗ ${name}: ${error.message}`);
    }
    // Be polite to the public site, while keeping the command practical.
    await sleep(150);
}

const dollNames = Object.keys(dolls).sort((left, right) => left.localeCompare(right));
const namesChanged = JSON.stringify(relicInfo.DOLL_NAMES) !== JSON.stringify(dollNames);
relicInfo.DOLL_NAMES = dollNames;

await writeJson(DOLLS_PATH, dolls);
await writeJson(RELIC_INFO_PATH, relicInfo);

console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${discoveredDolls} newly discovered doll(s), ${metadataChanges} existing definition(s) with missing data, ${portraitChanges} portrait(s), and ${namesChanged ? 'the' : 'no'} DOLL_NAMES enumeration.`);
if (failures.length) {
    console.error(`\n${failures.length} doll(s) failed; no data was removed. Review the errors and run again.`);
    process.exitCode = 1;
}
