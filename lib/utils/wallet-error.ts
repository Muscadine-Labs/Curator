/**
 * Compact wallet / viem write errors for UI — avoid dumping full Request Arguments.
 */

export type WalletErrorSummary = {
  /** One-line message shown by default. */
  summary: string;
  /** Full technical text (expandable). */
  details: string | null;
  isRejection: boolean;
};

function rawErrorText(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const anyErr = error as Error & { shortMessage?: string; details?: string };
    const parts = [anyErr.shortMessage, anyErr.message, anyErr.details].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0
    );
    return [...new Set(parts)].join('\n');
  }
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

export function isWalletRejection(error: unknown): boolean {
  const text = rawErrorText(error).toLowerCase();
  return (
    text.includes('user rejected') ||
    text.includes('user denied') ||
    text.includes('user cancelled') ||
    text.includes('user canceled') ||
    text.includes('rejected the request') ||
    text.includes('action_rejected') ||
    text.includes('action_cancelled') ||
    text.includes('4001') ||
    text.includes('request rejected')
  );
}

/**
 * Prefer a short headline; keep the full viem dump only as expandable details.
 */
export function summarizeWalletError(error: unknown): WalletErrorSummary {
  const details = rawErrorText(error).trim() || null;

  if (isWalletRejection(error)) {
    return {
      summary: 'Cancelled.',
      details: null,
      isRejection: true,
    };
  }

  if (details) {
    const lower = details.toLowerCase();
    if (lower.includes('0xace2a47e') || lower.includes('transferreverted')) {
      return {
        summary:
          'Allocate failed: not enough idle cash at that step. Min other markets first, then Max — or reduce the target.',
        details,
        isRejection: false,
      };
    }

    // First non-empty line, strip "Details:" prefixes for the summary.
    const firstLine =
      details
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0 && !/^docs:/i.test(l) && !/^version:/i.test(l)) ??
      'Transaction failed.';

    const summary =
      firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
    const needsDetails = details.includes('\n') || details.length > summary.length + 20;

    return {
      summary,
      details: needsDetails ? details : null,
      isRejection: false,
    };
  }

  return {
    summary: 'Transaction failed. Please try again.',
    details: null,
    isRejection: false,
  };
}
