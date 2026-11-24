/**
 * Checks each sentence for a fact citation and stops novel numbers.
 * This is intentionally conservative; it is not a semantic entailment checker.
 */
export function validateNarrative(candidate, facts) {
    const violations = [];
    const validIds = new Set(facts.map((fact) => fact.id));
    if (!candidate.trim() || candidate.length > 8000) {
        violations.push("Narrative is empty or exceeds the maximum length.");
        return { valid: false, violations };
    }
    const paragraphs = candidate
        .trim()
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);
    const allowedNumbers = new Set();
    const numbers = /(?<![A-Za-z])\d[\d,.]*(?:%|\b)/g;
    const canonical = (value) => value.replace(/,/g, "").replace(/%$/, "").replace(/\.$/, "");
    for (const fact of facts) {
        for (const match of fact.value.replace(/\bF\d+\b/g, "").matchAll(numbers)) {
            allowedNumbers.add(canonical(match[0]));
        }
    }
    for (let index = 0; index < paragraphs.length; index++) {
        const paragraph = paragraphs[index];
        const citations = [...paragraph.matchAll(/\[(F\d+)\]/g)].map((match) => match[1]);
        if (!citations.length)
            violations.push(`Paragraph ${index + 1} has no fact citation.`);
        // Candidate prose is accepted only when individual sentences include traceable citations.
        // Split only at sentence endings before an uppercase word; do not split decimal values.
        const sentences = paragraph
            .replace(/([.!?](?:\s*\[F\d+\])*)\s+(?=[A-Z])/g, "$1\u001e")
            .split("\u001e")
            .filter(Boolean);
        for (const [sentenceIndex, sentence] of sentences.entries()) {
            if (!/\[F\d+\]/.test(sentence)) {
                violations.push(`Paragraph ${index + 1}, sentence ${sentenceIndex + 1} lacks a fact ID.`);
            }
        }
        for (const cited of citations) {
            if (!validIds.has(cited))
                violations.push(`Unknown fact ID ${cited}.`);
        }
        // Citation identifiers are not numeric claims.
        const withoutCitations = paragraph
            .replace(/\[(F\d+)\]/g, "")
            .replace(/\bF\d+\b/g, "");
        for (const match of withoutCitations.matchAll(numbers)) {
            if (!allowedNumbers.has(canonical(match[0]))) {
                violations.push(`Paragraph ${index + 1} uses an unsupported number: ${match[0]}.`);
            }
        }
    }
    return { valid: violations.length === 0, violations };
}
