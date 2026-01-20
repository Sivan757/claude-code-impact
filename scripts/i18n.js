#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * i18n Management Script for Claude Code Impact
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
    ignoredDirs: new Set(['node_modules', '.git', 'dist', 'build', 'src-tauri', 'target', 'scripts']),
    ignoredFiles: new Set([
        'src/views/AnnualReport/AnnualReport2025.tsx',
        'src/views/Chat/CopyButton.tsx',
        'src/constants/index.ts',
        'src/views/Workspace/LogoManager.tsx'
    ]),
    supportedExtensions: new Set(['.ts', '.tsx', '.js', '.jsx']),
    localeFiles: [
        { code: 'en', file: 'en.json' },
        { code: 'zh', file: 'zh.json' }
    ],
    // Keys that usually hold technical values, not user-facing text
    ignoredPropertyKeys: new Set([
        'id', 'key', 'storageKey', 'type', 'defaultValue', 'min', 'max', 'direction',
        'align', 'variant', 'size', 'className', 'bodyClassName', 'headerClassName', 'footerClassName',
        'view_mode', 'active_session_id', 'cwd', 'commitHash', 'limit', 'lang', 'language', 'mode',
        'status', 'role', 'aria-describedby', 'aria-labelledby', 'data-testid', 'testId', 'ref',
        'containerRef', 'storagePath', 'matcher', 'eventType', 'field', 'command',
        'path', 'url', 'href', 'src', 'alt', 'icon', 'category', 'templateName', 'docsUrl',
        'rel', 'target', 'method', 'encoding', 'weight', 'opacity', 'zIndex', 'position',
        'top', 'bottom', 'left', 'right', 'img', 'avatar', 'cover',
        'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
        'boxShadow', 'textShadow', 'letterSpacing', 'borderBottom', 'borderLeft', 'borderRight', 'borderTop',
        'gridTemplateColumns', 'transformOrigin', 'fontFamily', 'padding', 'margin', 'display'
    ]),
    // Common technical values to ignore
    ignoredVals: new Set([
        'pending', 'running', 'completed', 'needs-review', 'active', 'deprecated', 'archived',
        'vertical', 'horizontal', 'terminal', 'flat', 'tree', 'desc', 'asc', 'outline',
        'ghost', 'secondary', 'destructive', 'link', 'sm', 'lg', 'icon', 'none', 'inherit',
        'top', 'bottom', 'left', 'right', 'center', 'noopener', 'noreferrer', 'blank', 'self'
    ]),
    // Common UI words that are allowed even if they are single words without spaces
    allowedSingleWords: new Set([
        'Add', 'Edit', 'Save', 'Cancel', 'Delete', 'Remove', 'Search', 'Open', 'Close',
        'Update', 'Refresh', 'Clear', 'Test', 'Apply', 'Back', 'Next', 'Forward',
        'Create', 'View', 'Hide', 'Show', 'Help', 'Done', 'Archive', 'Restore',
        'Terminal', 'Skills', 'Hooks', 'Context', 'Reference', 'Settings', 'Management',
        'Marketplace', 'Dashboard', 'Overview', 'Export', 'Import', 'Rebuild', 'Build'
    ]),
    matchAllLiterals: process.argv.includes('--all'),
};

const PATTERNS = {
    translationKeys: [
        /(?:^|[^A-Za-z0-9_])t\s*\(\s*(['"`])([^'"`]+?)\1/g
    ],
    // JSX text nodes: >...<
    jsxTextNode: />\s*([^<{}>]*[A-Za-z\u4e00-\u9fff][^<{}>]*)\s*</g,
    // Common attributes for user-facing text
    jsxAttributes: /\b(title|aria-label|placeholder|label|message|subtitle|hint|description|trigger)\s*=\s*(['"])([^'"]*[A-Za-z\u4e00-\u9fff][^'"]*)\2/g,
    // Object property assignment: key: "value"
    objectProperty: /\b([A-Za-z0-9_]+)\s*:\s*(['"`])([^'"`]+?)\2/g,
    // Assignment: var = "value"
    assignment: /\b([A-Za-z0-9_]+)\s*=\s*(['"`])([^'"`]+?)\2/g,
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
function looksLikeUserText(text, contextKey = null) {
    const normalized = normalizeSnippet(text);
    if (!normalized) return false;

    // Check against ignored technical values
    if (CONFIG.ignoredVals.has(normalized.toLowerCase())) return false;

    // If we have a context key (e.g. from an object property or attribute)
    if (contextKey && CONFIG.ignoredPropertyKeys.has(contextKey)) {
        return false;
    }

    // Always keep Chinese text.
    if (/[\u4e00-\u9fff]/.test(normalized)) return true;

    // Skip trivial single-character UI glyphs or common punctuation used as text.
    if (normalized.length <= 1) return false;
    if (/^[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(normalized)) return false;

    // Heuristics for English-ish UI text.
    if (/[A-Za-z]/.test(normalized)) {
        // Ignore CSS-like values or technical strings (e.g. "bg-card", "item-1")
        if (/^[a-z\-0-9]+$/.test(normalized) && normalized.includes('-')) return false;

        // Ignore common template artefacts or CSS classes.
        if (normalized.includes('{') || normalized.includes('}')) return false;

        // Ignore tailwind-like class lists
        if (normalized.split(' ').every(word =>
            /^[a-z0-9\-\/\\:]+$/.test(word) &&
            (word.includes('-') || word.includes(':') || word.includes('/') || /^[0-9]+$/.test(word))
        )) return false;

        // Paths are usually technical
        if ((normalized.includes('/') || normalized.includes('\\')) && !normalized.includes(' ')) return false;

        // Require at least one word boundary/space OR be a known UI word.
        if (/\s/.test(normalized)) return true;
        if (CONFIG.allowedSingleWords.has(normalized)) return true;

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
                if (CONFIG.ignoredFiles.has(entryPath.replace(/\\/g, '/'))) continue;
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

            // Manual ignore flag
            if (lineText.includes('// i18n-ignore')) return;

            // Skip technical lines
            if (lineText.trim().startsWith('case ') && lineText.includes(':')) return;

            if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
                this.scanJsxLine(filePath, lineText, lineNumber);
            } else {
                this.scanCodeLine(filePath, lineText, lineNumber);
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
            if (!looksLikeUserText(value, attrName)) continue;
            if (value.includes('t(')) continue;
            this.addFinding(filePath, lineNumber, match.index + 1, `attr:${attrName}`, value);
        }

        // 3. Object properties or assignments
        this.scanCodeLine(filePath, lineText, lineNumber);
    }

    scanCodeLine(filePath, lineText, lineNumber) {
        let match;
        // Object properties
        PATTERNS.objectProperty.lastIndex = 0;
        while ((match = PATTERNS.objectProperty.exec(lineText)) !== null) {
            const key = match[1];
            const value = match[3];
            if (looksLikeUserText(value, key)) {
                this.addFinding(filePath, lineNumber, match.index + 1, `prop:${key}`, value);
            }
        }

        // Assignments
        PATTERNS.assignment.lastIndex = 0;
        while ((match = PATTERNS.assignment.exec(lineText)) !== null) {
            const key = match[1];
            const value = match[3];
            if (looksLikeUserText(value, key)) {
                this.addFinding(filePath, lineNumber, match.index + 1, `assign:${key}`, value);
            }
        }
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
    console.log('🔍 Starting i18n analysis for Claude Code Impact...');

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
