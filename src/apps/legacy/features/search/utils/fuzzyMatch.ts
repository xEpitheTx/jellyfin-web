export interface FuzzyEntry {
    Id?: string
    Name?: string | null
}

export function normalizeForSearch(text: string) {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Edit distance counting insertions, deletions, substitutions and swapped neighbors. */
export function editDistance(a: string, b: string) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    for (let i = 0; i < rows; i++) d[i][0] = i;
    for (let j = 0; j < cols; j++) d[0][j] = j;

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }

    return d[a.length][b.length];
}

/** Typos allowed for a query of this length. */
export function allowedTypos(queryLength: number) {
    if (queryLength < 3) return 0;
    if (queryLength <= 4) return 1;
    if (queryLength <= 8) return 2;
    return 3;
}

/**
 * Distance between a query and a title, comparing the query against the whole
 * title and against every run of title words of the same length, so
 * "godfathr" matches "The Godfather". Null when it is not a close match.
 */
export function fuzzyScore(query: string, title: string): number | null {
    const q = normalizeForSearch(query);
    const t = normalizeForSearch(title);
    if (!q || !t) return null;
    if (t.includes(q)) return 0;

    const maxTypos = allowedTypos(q.replace(/ /g, '').length);
    if (!maxTypos) return null;

    const queryWordCount = q.split(' ').length;
    const titleWords = t.split(' ');
    const candidates = [ t ];
    for (let size = Math.max(1, queryWordCount - 1); size <= queryWordCount + 1; size++) {
        for (let start = 0; start + size <= titleWords.length; start++) {
            candidates.push(titleWords.slice(start, start + size).join(' '));
        }
    }

    let best = Infinity;
    for (const candidate of candidates) {
        // Cheap length check before the full distance.
        if (Math.abs(candidate.length - q.length) > maxTypos) continue;
        best = Math.min(best, editDistance(q, candidate));
        if (best === 0) break;
    }

    return best <= maxTypos ? best : null;
}

/** Ids of the closest matches, best first. */
export function findFuzzyMatches(query: string, entries: FuzzyEntry[], limit = 24): string[] {
    const matches: { id: string, score: number, nameLength: number }[] = [];

    for (const entry of entries) {
        if (!entry.Id || !entry.Name) continue;
        const score = fuzzyScore(query, entry.Name);
        if (score !== null) {
            matches.push({ id: entry.Id, score, nameLength: entry.Name.length });
        }
    }

    matches.sort((a, b) => a.score - b.score || a.nameLength - b.nameLength);
    return matches.slice(0, limit).map(match => match.id);
}
