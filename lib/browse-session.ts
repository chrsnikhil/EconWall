/**
 * Browse Session Management
 * Tracks clicks per wallet for batch swap triggering
 */

// Prevent HMR from resetting stats in development
const globalForSession = global as unknown as {
    clickCounts: Map<string, number>;
    swapCounts: Map<string, number>;
};

// In-memory click counter per wallet
const clickCounts = globalForSession.clickCounts || new Map<string, number>();
// persistent swap counter per wallet
const swapCounts = globalForSession.swapCounts || new Map<string, number>();

if (process.env.NODE_ENV !== 'production') {
    globalForSession.clickCounts = clickCounts;
    globalForSession.swapCounts = swapCounts;
}

// Batch swap threshold (every N clicks)
const BATCH_THRESHOLD = 10;

/**
 * Increment click count for a wallet
 * @returns new click count
 */
export function incrementClicks(wallet: string): number {
    const current = clickCounts.get(wallet.toLowerCase()) || 0;
    const newCount = current + 1;
    clickCounts.set(wallet.toLowerCase(), newCount);
    console.log(`[BrowseSession] Wallet ${wallet.slice(0, 8)}... clicks: ${newCount}`);
    return newCount;
}

/**
 * Check if wallet has reached swap threshold
 */
export function shouldTriggerSwap(wallet: string): boolean {
    const count = clickCounts.get(wallet.toLowerCase()) || 0;
    return count >= BATCH_THRESHOLD;
}

/**
 * Reset click count after swap
 */
export function resetClicks(wallet: string): void {
    clickCounts.set(wallet.toLowerCase(), 0);
    console.log(`[BrowseSession] Reset clicks for ${wallet.slice(0, 8)}...`);
}

// Track wallets currently executing a swap
const swapInProgress = new Set<string>();

/**
 * Check if a swap is already in progress for this wallet
 */
export function isSwapInProgress(wallet: string): boolean {
    return swapInProgress.has(wallet.toLowerCase());
}

/**
 * Set swap lock state
 */
export function setSwapLock(wallet: string, locked: boolean): void {
    const key = wallet.toLowerCase();
    if (locked) {
        swapInProgress.add(key);
    } else {
        swapInProgress.delete(key);
    }
}

/**
 * Get current click count
 */
export function getClickCount(wallet: string): number {
    return clickCounts.get(wallet.toLowerCase()) || 0;
}

/**
 * Increment total swap count (persistent)
 */
export function incrementTotalSwaps(wallet: string): number {
    const current = swapCounts.get(wallet.toLowerCase()) || 0;
    const newCount = current + 1;
    swapCounts.set(wallet.toLowerCase(), newCount);
    console.log(`[BrowseSession] Wallet ${wallet.slice(0, 8)}... Total Swaps: ${newCount}`);
    return newCount;
}

/**
 * Get total swap count
 */
export function getTotalSwaps(wallet: string): number {
    return swapCounts.get(wallet.toLowerCase()) || 0;
}

// Max clicks allowed before blocking (grace period)
const BATCH_LIMIT = 25;

/**
 * Check if access should be blocked (exceeded grace period)
 */
export function isAccessBlocked(wallet: string): boolean {
    // If a swap is actively processing, DO NOT BLOCK. Allow buffer.
    if (isSwapInProgress(wallet)) {
        return false;
    }

    const count = clickCounts.get(wallet.toLowerCase()) || 0;
    return count >= BATCH_LIMIT;
}

// Track failed swaps per wallet
const failedSwapCounts = new Map<string, number>();

// Max failed swaps before kicking user
const MAX_FAILURES = 5;

/**
 * Increment failed swap count
 */
export function incrementFailures(wallet: string): number {
    const current = failedSwapCounts.get(wallet.toLowerCase()) || 0;
    const newCount = current + 1;
    failedSwapCounts.set(wallet.toLowerCase(), newCount);
    console.log(`[BrowseSession] Wallet ${wallet.slice(0, 8)}... failures: ${newCount}/${MAX_FAILURES}`);
    return newCount;
}

/**
 * Reset failures on success
 */
export function resetFailures(wallet: string): void {
    failedSwapCounts.set(wallet.toLowerCase(), 0);
}

/**
 * Check if max failures reached
 */
export function isMaxFailuresReached(wallet: string): boolean {
    const count = failedSwapCounts.get(wallet.toLowerCase()) || 0;
    return count >= MAX_FAILURES;
}

/**
 * Get batch threshold
 */
export function getBatchThreshold(): number {
    return BATCH_THRESHOLD;
}
