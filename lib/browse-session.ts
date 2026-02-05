/**
 * Browse Session Management
 * Tracks clicks per wallet for batch swap triggering
 */

// In-memory click counter per wallet
const clickCounts = new Map<string, number>();

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

// Max clicks allowed before blocking (grace period)
const BATCH_LIMIT = 15;

/**
 * Check if access should be blocked (exceeded grace period)
 */
export function isAccessBlocked(wallet: string): boolean {
    const count = clickCounts.get(wallet.toLowerCase()) || 0;
    return count >= BATCH_LIMIT;
}

/**
 * Get batch threshold
 */
export function getBatchThreshold(): number {
    return BATCH_THRESHOLD;
}
