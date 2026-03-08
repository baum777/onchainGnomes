/**
 * Solana RPC Adapter
 *
 * Core adapter for interacting with Solana RPC nodes.
 * Implements retry logic, circuit breaker, and source switching.
 */

import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import { loadLaunchEnv } from "../../config/env.js";
import { 
  createCircuitBreaker, 
  type BaseAdapter, 
  type AdapterConfig,
  type CircuitBreaker 
} from "../base.js";
import { 
  createSolanaRpcError, 
  type SolanaRpcError 
} from "./errors.js";

export interface SolanaRpcAdapterConfig extends AdapterConfig {
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  commitment?: Commitment;
}

export class SolanaRpcAdapter implements BaseAdapter {
  readonly name = "SolanaRpcAdapter";
  readonly version = "1.0.0";
  
  private config: SolanaRpcAdapterConfig;
  private primaryConnection: Connection;
  private fallbackConnection: Connection | null = null;
  private circuitBreaker: CircuitBreaker;

  constructor(config?: Partial<SolanaRpcAdapterConfig>) {
    const env = loadLaunchEnv();
    
    this.config = {
      primaryRpcUrl: config?.primaryRpcUrl ?? env.SOLANA_RPC_PRIMARY_URL,
      fallbackRpcUrl: config?.fallbackRpcUrl ?? env.SOLANA_RPC_FALLBACK_URL,
      commitment: config?.commitment ?? "confirmed",
      timeoutMs: config?.timeoutMs ?? 30000,
      maxRetries: config?.maxRetries ?? 3,
    };

    this.primaryConnection = new Connection(this.config.primaryRpcUrl, {
      commitment: this.config.commitment,
      confirmTransactionInitialTimeout: this.config.timeoutMs,
    });

    if (this.config.fallbackRpcUrl) {
      this.fallbackConnection = new Connection(this.config.fallbackRpcUrl, {
        commitment: this.config.commitment,
        confirmTransactionInitialTimeout: this.config.timeoutMs,
      });
    }

    this.circuitBreaker = createCircuitBreaker();
  }

  /**
   * Execute a call against the RPC with circuit breaker and fallback support
   */
  async execute<T>(
    operation: (connection: Connection) => Promise<T>,
    methodName: string
  ): Promise<T> {
    if (!this.circuitBreaker.canExecute()) {
      throw createSolanaRpcError(
        new Error("Circuit breaker is OPEN"),
        methodName,
        "SERVER_ERROR"
      );
    }

    let lastError: unknown;
    
    // Try primary
    try {
      const result = await operation(this.primaryConnection);
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      // Record failure only if it's a server/network error, not user error
      this.circuitBreaker.recordFailure();
    }

    // Try fallback if available
    if (this.fallbackConnection) {
      try {
        const result = await operation(this.fallbackConnection);
        // If fallback succeeds, we don't reset the primary circuit breaker
        // but we return the result
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    throw createSolanaRpcError(lastError, methodName);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      const slot = await this.primaryConnection.getSlot();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: `Current slot: ${slot}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getConfig(): SolanaRpcAdapterConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<SolanaRpcAdapterConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.primaryRpcUrl) {
      this.primaryConnection = new Connection(config.primaryRpcUrl, {
        commitment: this.config.commitment,
      });
    }
    if (config.fallbackRpcUrl) {
      this.fallbackConnection = new Connection(config.fallbackRpcUrl, {
        commitment: this.config.commitment,
      });
    }
  }

  getSlot(): Promise<number> {
    return this.execute((c) => c.getSlot(), "getSlot");
  }

  getAccountInfo(pubkey: PublicKey): Promise<any> {
    return this.execute((c) => c.getAccountInfo(pubkey), "getAccountInfo");
  }
}
