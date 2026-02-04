'use client';

import { usePrivy, useWallets, useSigners, useCreateWallet } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ShieldCheck, ShieldAlert, BadgeCheck, Plus } from "lucide-react";

// Get key quorum ID from env (you'll set this after creating it in Privy Dashboard)
const KEY_QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID || '';

export default function WalletManager() {
    // @ts-ignore - access login directly
    const { ready, authenticated, user, login } = usePrivy();
    const { wallets } = useWallets();
    const { addSigners, getSigners } = useSigners();
    const { createWallet } = useCreateWallet();

    const [embeddedWallet, setEmbeddedWallet] = useState<any>(null);
    const [isDelegated, setIsDelegated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [creatingWallet, setCreatingWallet] = useState(false);

    useEffect(() => {
        // Debug: Log what Privy sees
        console.log('[WalletManager] Auth:', authenticated);
        console.log('[WalletManager] Wallets from useWallets():', wallets);
        console.log('[WalletManager] User linkedAccounts:', user?.linkedAccounts);

        // Debug: Log all wallet types in detail
        wallets.forEach((w: any, i: number) => {
            console.log(`[WalletManager] Wallet ${i}:`, {
                walletClientType: w.walletClientType,
                connectorType: w.connectorType,
                address: w.address,
                walletClient: w.walletClient,
            });
        });

        if (authenticated) {
            // Only find actual embedded wallets - no fallbacks
            let embedded = wallets.find((w: any) => w.walletClientType === 'privy');
            if (!embedded) {
                embedded = wallets.find((w: any) => w.connectorType === 'embedded');
            }
            // DO NOT use fallback - we need the actual embedded wallet
            console.log('[WalletManager] Found embedded wallet:', embedded);
            setEmbeddedWallet(embedded || null);

            const delegatedAccount = user?.linkedAccounts?.find(
                (account: any) =>
                    account.type === 'wallet' &&
                    account.walletClientType === 'privy' &&
                    account.delegated === true
            );
            setIsDelegated(!!delegatedAccount);
        } else {
            setEmbeddedWallet(null);
        }
    }, [authenticated, wallets, user]);

    const handleDelegate = async () => {
        if (!embeddedWallet) return;
        if (!KEY_QUORUM_ID) {
            console.error('❌ KEY_QUORUM_ID not set. Please set NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID in .env.local');
            return;
        }
        setLoading(true);

        try {
            // For TEE wallets, we add the app's key quorum as a signer
            await addSigners({
                address: embeddedWallet.address,
                signers: [{
                    signerId: KEY_QUORUM_ID,
                    policyIds: [] // Empty array = full permission
                }]
            });
            setIsDelegated(true);
            console.log('✅ Signer added to wallet successfully!');
        } catch (error) {
            console.error('❌ Adding signer failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWallet = async () => {
        setCreatingWallet(true);
        try {
            console.log('[WalletManager] Creating embedded wallet...');
            const wallet = await createWallet();
            console.log('[WalletManager] ✅ Wallet created:', wallet);
            setEmbeddedWallet(wallet);
        } catch (error) {
            console.error('[WalletManager] ❌ Failed to create wallet:', error);
        } finally {
            setCreatingWallet(false);
        }
    };

    if (!ready) return null;

    if (!authenticated) {
        return (
            <Card className="w-full bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-400" />
                        Server Wallet Access
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-zinc-500 mb-3">
                        Connect to the server to enable advanced features like automated trading.
                    </div>
                    <Button
                        onClick={login}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs gap-2"
                    >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Connect Server Account
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-400" />
                    Server Wallet Access
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                    Authorize the server to execute trades on your behalf.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {embeddedWallet ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-400 font-mono">
                                    {embeddedWallet.address.slice(0, 6)}...{embeddedWallet.address.slice(-4)}
                                </span>
                                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                                    Embedded Wallet
                                </span>
                            </div>
                            {isDelegated ? (
                                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs">
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                    <span>Active</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2 py-1 rounded text-xs">
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    <span>Required</span>
                                </div>
                            )}
                        </div>

                        {!isDelegated ? (
                            <Button
                                onClick={handleDelegate}
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-2"
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {loading ? "Authorizing..." : "Enable Server Actions"}
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 justify-center">
                                <ShieldCheck className="h-3 w-3" />
                                Server authorized to optimize trades
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-xs text-zinc-400 text-center">
                            No embedded wallet found. Create one to enable server-side trading.
                        </div>
                        <Button
                            onClick={handleCreateWallet}
                            disabled={creatingWallet}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs gap-2"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {creatingWallet ? "Creating Wallet..." : "Create Embedded Wallet"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
