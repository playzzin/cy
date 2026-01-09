import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

type Match = {
    file: string;
    collection: string;
    line: number;
    snippet: string;
};

type CollectionSummary = {
    name: string;
    hits: number;
    files: string[];
    samples: Array<{ file: string; line: number; snippet: string }>;
};

const argValue = (name: string): string | null => {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return null;
    const value = process.argv[idx + 1];
    return value ? String(value) : null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SOURCE_DIRS = [
    path.join(PROJECT_ROOT, 'src'),
    path.join(PROJECT_ROOT, 'functions'),
    path.join(PROJECT_ROOT, 'scripts')
].filter((p) => fs.existsSync(p));

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const walk = (dir: string, out: string[] = []): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === 'node_modules' || ent.name === 'build' || ent.name === 'dist') continue;
            walk(full, out);
            continue;
        }
        const ext = path.extname(ent.name);
        if (!EXTENSIONS.has(ext)) continue;
        if (path.resolve(full) === path.resolve(__filename)) continue;
        out.push(full);
    }
    return out;
};

// Naive regex: collection(db, 'name') or collection(db,"name")
const COLLECTION_RE = /collection\(\s*db\s*,\s*['\"]([^'\"]+)['\"]/g;

// Other common pattern: doc(db, 'collection', id)
const DOC_RE = /doc\(\s*db\s*,\s*['\"]([^'\"]+)['\"]/g;

// Variable-based forms: collection(db, COLLECTION_NAME, ...) or doc(db, COLLECTION_NAME, ...)
const COLLECTION_VAR_RE = /collection\(\s*db\s*,\s*([A-Za-z0-9_]+)/g;
const DOC_VAR_RE = /doc\(\s*db\s*,\s*([A-Za-z0-9_]+)/g;

// Simple string constant definition: const COLLECTION_NAME = 'workers'
const CONST_STRING_RE = /const\s+([A-Za-z0-9_]+)\s*=\s*['\"]([^'\"]+)['\"]/g;

const readLines = (file: string): string[] => {
    const raw = fs.readFileSync(file, 'utf8');
    return raw.split(/\r?\n/);
};

const scanFile = (file: string): Match[] => {
    const lines = readLines(file);
    const matches: Match[] = [];

    // Build a per-file constant map (very naive, line-based)
    const constMap = new Map<string, string>();
    for (const line of lines) {
        let m: RegExpExecArray | null;
        CONST_STRING_RE.lastIndex = 0;
        while ((m = CONST_STRING_RE.exec(line))) {
            constMap.set(m[1], m[2]);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;

        let m: RegExpExecArray | null;
        COLLECTION_RE.lastIndex = 0;
        while ((m = COLLECTION_RE.exec(line))) {
            matches.push({
                file,
                collection: m[1],
                line: i + 1,
                snippet: line.trim()
            });
        }

        DOC_RE.lastIndex = 0;
        while ((m = DOC_RE.exec(line))) {
            matches.push({
                file,
                collection: m[1],
                line: i + 1,
                snippet: line.trim()
            });
        }

        COLLECTION_VAR_RE.lastIndex = 0;
        while ((m = COLLECTION_VAR_RE.exec(line))) {
            const resolved = constMap.get(m[1]);
            if (!resolved) continue;
            matches.push({
                file,
                collection: resolved,
                line: i + 1,
                snippet: line.trim()
            });
        }

        DOC_VAR_RE.lastIndex = 0;
        while ((m = DOC_VAR_RE.exec(line))) {
            const resolved = constMap.get(m[1]);
            if (!resolved) continue;
            matches.push({
                file,
                collection: resolved,
                line: i + 1,
                snippet: line.trim()
            });
        }
    }

    return matches;
};

const main = () => {
    const outJsonPath = argValue('--out-json');
    const summaryOnly = process.argv.includes('--summary-only');

    const files = SOURCE_DIRS.flatMap((d) => walk(d));

    const allMatches: Match[] = [];
    for (const f of files) {
        try {
            allMatches.push(...scanFile(f));
        } catch {
            // ignore unreadable files
        }
    }

    const byCollection = new Map<string, Match[]>();
    for (const m of allMatches) {
        const arr = byCollection.get(m.collection) ?? [];
        arr.push(m);
        byCollection.set(m.collection, arr);
    }

    const collections = [...byCollection.keys()].sort((a, b) => a.localeCompare(b));

    const summary: CollectionSummary[] = collections.map((name) => {
        const hits = byCollection.get(name) ?? [];
        const uniqueFiles = [...new Set(hits.map((h) => path.relative(PROJECT_ROOT, h.file)))].sort();
        const samples = hits.slice(0, 10).map((h) => ({
            file: path.relative(PROJECT_ROOT, h.file),
            line: h.line,
            snippet: h.snippet
        }));
        return {
            name,
            hits: hits.length,
            files: uniqueFiles,
            samples
        };
    });

    if (outJsonPath) {
        const abs = path.isAbsolute(outJsonPath) ? outJsonPath : path.join(PROJECT_ROOT, outJsonPath);
        fs.writeFileSync(abs, JSON.stringify({
            scannedFiles: files.length,
            uniqueCollections: summary.length,
            collections: summary
        }, null, 2), 'utf8');
    }

    console.log('# Firestore collection usage (static scan)');
    console.log(`- scanned files: ${files.length}`);
    console.log(`- unique collections referenced: ${collections.length}`);

    for (const c of collections) {
        const hits = byCollection.get(c) ?? [];
        const uniqueFiles = new Set(hits.map((h) => path.relative(PROJECT_ROOT, h.file)));
        console.log(`\n## ${c}`);
        console.log(`- hits: ${hits.length}`);
        console.log(`- files: ${uniqueFiles.size}`);
        if (!summaryOnly) {
            // show up to 5 samples
            hits.slice(0, 5).forEach((h) => {
                console.log(`  - ${path.relative(PROJECT_ROOT, h.file)}:${h.line} :: ${h.snippet}`);
            });
        }
    }

    console.log('\n# Done');
};

main();
