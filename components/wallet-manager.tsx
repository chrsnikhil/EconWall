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
        console.log('[Agent: Identity] Auth:', authenticated);
        console.log('[Agent: Identity] Wallets from useWallets():', wallets);
        console.log('[Agent: Identity] User accounts:', user?.linkedAccounts);

        // Debug: Log all wallet types in detail
        wallets.forEach((w: any, i: number) => {
            console.log(`[Agent: Identity] Wallet ${i}:`, {
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
            console.log('[Agent: Identity] Found embedded wallet:', embedded);
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
            console.log('[Agent: Identity] Creating autonomous embedded wallet...');
            const wallet = await createWallet();
            console.log('[Agent: Identity] ✅ Wallet provisioned:', wallet);
            setEmbeddedWallet(wallet);
        } catch (error) {
            console.error('[Agent: Identity] ❌ Failed to provision wallet:', error);
        } finally {
            setCreatingWallet(false);
        }
    };

    if (!ready) return null;

    if (!authenticated) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/40">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Server Access</span>
                </div>
                <Button
                    onClick={login}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 h-8 text-[10px] uppercase tracking-widest gap-2 font-bold"
                >
                    Connect Account
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/40">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Server Access</span>
                </div>
                {embeddedWallet && (
                    isDelegated ? (
                        <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                            <BadgeCheck className="h-3 w-3" /> Active
                        </span>
                    ) : (
                        <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Required
                        </span>
                    )
                )}
            </div>

            {embeddedWallet ? (
                !isDelegated ? (
                    <Button
                        onClick={handleDelegate}
                        disabled={loading}
                        className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 h-8 text-[10px] uppercase tracking-widest gap-2 font-bold"
                    >
                        {loading ? "Authorizing..." : "Enable Access"}
                    </Button>
                ) : (
                    <div className="px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                        <p className="text-[9px] text-emerald-500/60 uppercase tracking-widest font-bold">
                            Optimization Active
                        </p>
                    </div>
                )
            ) : (
                <Button
                    onClick={handleCreateWallet}
                    disabled={creatingWallet}
                    className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 h-8 text-[10px] uppercase tracking-widest gap-2 font-bold"
                >
                    <Plus className="h-3 w-3" />
                    {creatingWallet ? "Creating..." : "Create Wallet"}
                </Button>
            )}
        </div>
    );
}
