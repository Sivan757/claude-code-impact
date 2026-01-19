#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * i18n Management Script for Lovcode
 * 
 * Features:
 * 1. Verify locale files consistency (keys present in all languages).
 * 2. Verify source code usage of translation keys (missing from locales).
 * 3. Scan for hardcoded literals that might need translation.
 */

// --- Configuration ---

const CONFIG = {
    localesDir: 'src/locales',
    sourceRoots: ['src'],
    ignoredDirs: new Set(['node_modules', '.git', 'dist', 'build', 'src-tauri', 'target']),
    supportedExtensions: new Set(['.ts', '.tsx', '.js', '.jsx']),
    localeFiles: [
        { code: 'en', file: 'en.json' },
        { code: 'zh', file: 'zh.json' }
    ],
    // Heuristics for English-ish UI text in find-literals
    matchAllLiterals: process.argv.includes('--all'),
};

const PATTERNS = {
    translationKeys: [
        /(?:^|[^A-Za-z0-9_])t\s*\(\s*(['"`])([^'"`]+?)\1/g
    ],
    // JSX text nodes: >...<
    jsxTextNode: />([^<{}>]*[A-Za-z\u4e00-\u9fff][^<{}>]*)</g,
    // Common attributes for user-facing text
    jsxAttributes: /\b(title|aria-label|placeholder|alt|label)\s*=\s*(['"])([^'"]*[A-Za-z\u4e00-\u9fff][^'"]*)\2/g,
};

// --- Utilities ---

async function statOrNull(filePath) {
    try {
        return await fs.stat(filePath);
    } catch {
        return null;
    }
}

function normalizeSnippet(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Heuristics to decide if a string looks like user-facing text.
 */
function looksLikeUserText(text) {
    const normalized = normalizeSnippet(text);
    if (!normalized) return false;

    // Always keep Chinese text.
    if (/[\u4e00-\u9fff]/.test(normalized)) return true;

    // Skip trivial single-character UI glyphs.
    if (normalized.length <= 1) return false;

    // Heuristics for English-ish UI text.
    if (/[A-Za-z]/.test(normalized)) {
        // Ignore common template artefacts or CSS classes.
        if (normalized.includes('{') || normalized.includes('}')) return false;
        if (normalized.includes('/') || normalized.includes('\\')) return false;

        // Require at least one word boundary/space to reduce false positives (like class names).
        if (/\s/.test(normalized)) return true;

        // Keep single-word but "UI-ish" values when explicitly asked via --all.
        return CONFIG.matchAllLiterals;
    }

    return false;
}

function flattenKeys(obj, prefix = '', out = new Set()) {
    if (typeof obj !== 'object' || obj === null) {
        if (prefix) out.add(prefix);
        return out;
    }

    for (const [key, value] of Object.entries(obj)) {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        flattenKeys(value, nextPrefix, out);
    }

    return out;
}

// --- Scanner ---

class I18nScanner {
    constructor() {
        this.files = [];
        this.findings = {
            usedKeys: new Set(),
            hardcoded: [], // { file, line, col, kind, snippet }
        };
    }

    async collectFiles(rootDir) {
        const entries = await fs.readdir(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(rootDir, entry.name);
            if (entry.isDirectory()) {
                if (CONFIG.ignoredDirs.has(entry.name)) continue;
                await this.collectFiles(entryPath);
            } else if (entry.isFile()) {
                if (CONFIG.supportedExtensions.has(path.extname(entry.name))) {
                    this.files.push(entryPath);
                }
            }
        }
    }

    async scan() {
        for (const root of CONFIG.sourceRoots) {
            await this.collectFiles(root);
        }

        for (const filePath of this.files) {
            const content = await fs.readFile(filePath, 'utf8');
            this.scanForUsedKeys(content);
            this.scanForHardcoded(filePath, content);
        }
    }

    scanForUsedKeys(content) {
        for (const pattern of PATTERNS.translationKeys) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const key = match[2];
                // Ignore dynamic keys with template literals
                if (key && !key.includes('${')) {
                    this.findings.usedKeys.add(key);
                }
            }
        }
    }

    scanForHardcoded(filePath, content) {
        const lines = content.split(/\r?\n/);

        lines.forEach((lineText, i) => {
            const lineNumber = i + 1;

            if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx') || filePath.endsWith('.html')) {
                this.scanJsxLine(filePath, lineText, lineNumber);
            }
        });
    }

    scanJsxLine(filePath, lineText, lineNumber) {
        // 1. Text nodes: >...<
        let match;
        PATTERNS.jsxTextNode.lastIndex = 0;
        while ((match = PATTERNS.jsxTextNode.exec(lineText)) !== null) {
            const raw = match[1];
            if (!looksLikeUserText(raw)) continue;
            if (raw.includes('t(')) continue;

            this.addFinding(filePath, lineNumber, match.index + 1, 'text', raw);
        }

        // 2. Attributes
        PATTERNS.jsxAttributes.lastIndex = 0;
        while ((match = PATTERNS.jsxAttributes.exec(lineText)) !== null) {
            const attrName = match[1];
            const value = match[3];
            if (!looksLikeUserText(value)) continue;
            if (value.includes('t(')) continue;
            this.addFinding(filePath, lineNumber, match.index + 1, `attr:${attrName}`, value);
        }

        // 3. Probable standalone text lines in JSX
        const trimmed = lineText.trim();
        if (this.isProbableTextLine(trimmed)) {
            if (looksLikeUserText(trimmed)) {
                this.addFinding(filePath, lineNumber, lineText.indexOf(trimmed) + 1, 'text', trimmed);
            }
        }
    }

    isProbableTextLine(trimmed) {
        if (!trimmed) return false;
        if (trimmed.startsWith('<') || trimmed.startsWith('{') || trimmed.startsWith('}')) return false;
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return false;
        if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) return false;
        if (trimmed.includes('=>') || trimmed.includes('={')) return false;

        // Ignore lines that look like code
        if (/[;{}[\]()=]/.test(trimmed)) return false;

        return true;
    }

    addFinding(file, line, column, kind, snippet) {
        this.findings.hardcoded.push({
            file, line, column, kind,
            snippet: normalizeSnippet(snippet)
        });
    }
}

// --- Main execution ---

async function run() {
    console.log('🔍 Starting i18n analysis for Lovcode...');

    const scanner = new I18nScanner();
    await scanner.scan();

    // Load Locales
    const localeKeys = {};

    for (const { code, file } of CONFIG.localeFiles) {
        const filePath = path.join(CONFIG.localesDir, file);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            localeKeys[code] = flattenKeys(data);
        } catch (err) {
            console.error(`❌ Error loading locale ${code} (${file}):`, err.message);
            process.exit(1);
        }
    }

    let hasError = false;

    // 1. Verify Locales Consistency
    console.log('\n--- Locale Consistency ---');
    const [baseLocale, ...others] = CONFIG.localeFiles;
    const baseKeys = localeKeys[baseLocale.code];

    for (const other of others) {
        const otherKeys = localeKeys[other.code];

        const missingInOther = [...baseKeys].filter(k => !otherKeys.has(k));
        const extraInOther = [...otherKeys].filter(k => !baseKeys.has(k));

        if (missingInOther.length > 0) {
            console.log(`❌ Missing in ${other.code} (present in ${baseLocale.code}):`);
            missingInOther.forEach(k => console.log(`   - ${k}`));
            hasError = true;
        }
        if (extraInOther.length > 0) {
            console.log(`❌ Extra in ${other.code} (missing in ${baseLocale.code}):`);
            extraInOther.forEach(k => console.log(`   - ${k}`));
            hasError = true;
        }
    }

    if (!hasError) console.log(`✅ All locale files are synchronized (${baseKeys.size} keys).`);

    // 2. Verify Source Usage
    console.log('\n--- Source Key Usage ---');
    const missingFromLocales = [...scanner.findings.usedKeys].filter(k => !baseKeys.has(k));
    if (missingFromLocales.length > 0) {
        console.log('❌ Keys used in source but missing from locales:');
        missingFromLocales.forEach(k => console.log(`   - ${k}`));
        hasError = true;
    } else {
        console.log('✅ All keys used in source exist in locales.');
    }

    // 3. Hardcoded Literals
    console.log('\n--- Potential Hardcoded Literals ---');
    if (scanner.findings.hardcoded.length > 0) {
        console.log(`⚠️  Found ${scanner.findings.hardcoded.length} items that might need translation:`);
        scanner.findings.hardcoded.forEach(f => {
            console.log(`   ${f.file}:${f.line}:${f.column} [${f.kind}] ${f.snippet}`);
        });
    } else {
        console.log('✅ No hardcoded literals found.');
    }

    console.log('\n--- Summary ---');
    if (hasError) {
        console.log('❌ i18n verification failed.');
        process.exit(1);
    } else {
        console.log('✅ i18n verification passed.');
    }
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
