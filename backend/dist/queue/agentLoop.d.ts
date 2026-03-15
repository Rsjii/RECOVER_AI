export declare function startAgentLoop(): void;
export declare function stopAgentLoop(): Promise<void>;
/**
 * Run the decision engine synchronously and return results immediately.
 * Used by the manual trigger endpoint for real-time feedback.
 */
export declare function runDecisionEngineNow(): Promise<{
    total: number;
    emailsQueued: number;
    planOffersQueued: number;
    skipped: number;
}>;
