import { useState } from 'react';

interface WalletState {
  connected: boolean;
  address: string | null;
  dustBalance: bigint;
  nightBalance: bigint;
}

interface SponsorResult {
  status: string;
  transaction?: string;
  error?: string;
}

const SPONSOR_API = '/v1/sponsor';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    dustBalance: 0n,
    nightBalance: 0n,
  });
  const [counter, setCounter] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SponsorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    const midnight = (window as any).midnight;
    if (!midnight?.lace) {
      setError('Midnight wallet not found. Install Lace wallet extension.');
      return;
    }

    try {
      const api = await midnight.lace.enable();
      const address = await api.getAddress();
      const balances = await api.getBalance();

      setWallet({
        connected: true,
        address,
        dustBalance: BigInt(balances.dust ?? 0),
        nightBalance: BigInt(balances.night ?? 0),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const incrementCounter = async () => {
    if (!wallet.connected) {
      setError('Connect your wallet first');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const midnight = (window as any).midnight;
      const api = await midnight.lace.enable();

      // Step 1: Build the increment transaction (user side - no DUST needed)
      const unboundTx = await api.buildTransaction({
        contract: 'counter',
        circuit: 'increment',
      });

      // Step 2: Prepare sponsored call (balances only user value, never DUST)
      const txHex = await api.prepareSponsoredCall(unboundTx);

      // Step 3: Send to AetherDust sponsor API
      const response = await fetch(SPONSOR_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionHex: txHex,
          campaignId: 'demo-campaign',
          contractAddress: 'mn_counter_contract',
          entryPoint: 'increment',
          estimatedFeeSpeck: '1000',
          usageId: wallet.address ?? 'anonymous',
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.status === 'approved') {
        setCounter((c) => c + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">AetherDust Demo</h1>
          <p className="text-gray-400">Gasless transactions on Midnight</p>
        </header>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet</h2>
          {!wallet.connected ? (
            <button
              onClick={connectWallet}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
            >
              Connect Midnight Wallet
            </button>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-400">Address:</span> {wallet.address?.slice(0, 20)}...</p>
              <p><span className="text-gray-400">DUST:</span> {wallet.dustBalance.toString()} (zero = gasless!)</p>
              <p><span className="text-gray-400">NIGHT:</span> {wallet.nightBalance.toString()}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Counter Contract</h2>
          <div className="text-center">
            <p className="text-6xl font-bold mb-4">{counter}</p>
            <button
              onClick={incrementCounter}
              disabled={!wallet.connected || loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg text-lg transition"
            >
              {loading ? 'Sponsoring...' : 'Increment (Gasless)'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`rounded-lg p-4 mb-6 ${result.status === 'approved' ? 'bg-green-900' : 'bg-red-900'}`}>
            <p className="font-semibold">{result.status === 'approved' ? 'Sponsored!' : 'Rejected'}</p>
            {result.transaction && <p className="text-sm mt-1">TX: {result.transaction}</p>}
            {result.error && <p className="text-sm mt-1">{result.error}</p>}
          </div>
        )}

        {error && (
          <div className="bg-red-900 rounded-lg p-4 mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <footer className="text-center text-gray-500 text-sm mt-8">
          <p>AetherDust — Open-source DUST sponsorship for Midnight DApps</p>
          <p className="mt-1">User has zero DUST. Sponsor pays all fees.</p>
        </footer>
      </div>
    </div>
  );
}
