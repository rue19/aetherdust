import type { Logger } from 'pino';

export interface WalletProvider {
  getCoinPublicKey(): string;
  getEncryptionPublicKey(): string;
  getDustBalance(): Promise<bigint>;
  submitTx(tx: unknown): Promise<string>;
}

export class MockWalletProvider implements WalletProvider {
  private balance = 1_000_000_000_000_000n;

  constructor(private logger?: Logger) {}

  getCoinPublicKey(): string {
    return 'mock_coin_pk_' + Math.random().toString(36).slice(2, 10);
  }

  getEncryptionPublicKey(): string {
    return 'mock_enc_pk_' + Math.random().toString(36).slice(2, 10);
  }

  async getDustBalance(): Promise<bigint> {
    return this.balance;
  }

  async submitTx(tx: unknown): Promise<string> {
    const txId = `mock-tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger?.debug({ txId }, 'MockWalletProvider: submitTx');
    return txId;
  }
}
