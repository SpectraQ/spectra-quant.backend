// Raydium CPMM pool fetcher — drop-in replacement for the old
// `fetch("http://localhost:3000/api/raydium-pool")` calls. Lets the
// rebalancer + liquidity scripts run without the frontend.
//
// Mirrors frontend/app/api/raydium-pool/route.ts. Reads pool config from
// RAYDIUM_USDC_SOL_* env vars (populated by scripts/create_raydium_pool.ts)
// and live reserves + LP metadata from chain.

import { Connection, PublicKey } from "@solana/web3.js";

const WSOL_MINT_STR = "So11111111111111111111111111111111111111112";

export interface PoolView {
  programId: string;
  poolId: string;
  poolAuth: string | null;
  mintA: string;
  mintB: string;
  vaultA: string;
  vaultB: string;
  wsolReserve: string;
  wsolDecimals: number;
  usdcReserve: string;
  usdcDecimals: number;
  lpMint: string | null;
  lpDecimals: number | null;
  lpSupply: string | null;
}

// CpmmPoolInfoLayout (Raydium SDK V2). Offsets relevant here:
//   136  mintLp     (32)
//   330  lpDecimals (1)
//   333  lpAmount   (u64 LE)
function parsePoolMintLp(
  data: Buffer,
): { mintLp: string; lpDecimals: number; lpSupply: string } {
  const mintLp = new PublicKey(data.subarray(136, 136 + 32)).toBase58();
  const lpDecimals = data.readUInt8(330);
  const lpSupply = data.readBigUInt64LE(333).toString();
  return { mintLp, lpDecimals, lpSupply };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing env: ${name} — run scripts/demo.sh once to write RAYDIUM_USDC_SOL_* into .env`,
    );
  }
  return v;
}

export async function fetchPoolView(connection: Connection): Promise<PoolView> {
  const programId = requireEnv("RAYDIUM_CPMM_PROGRAM_ID");
  const poolId = requireEnv("RAYDIUM_USDC_SOL_POOL");
  const vaultA = requireEnv("RAYDIUM_USDC_SOL_VAULT_A");
  const vaultB = requireEnv("RAYDIUM_USDC_SOL_VAULT_B");
  const mintA = requireEnv("RAYDIUM_USDC_SOL_MINT_A");
  const mintB = requireEnv("RAYDIUM_USDC_SOL_MINT_B");
  const poolAuth = process.env.RAYDIUM_CPMM_POOL_AUTH ?? null;

  const [aBal, bBal, poolAccount] = await Promise.all([
    connection.getTokenAccountBalance(new PublicKey(vaultA)),
    connection.getTokenAccountBalance(new PublicKey(vaultB)),
    connection.getAccountInfo(new PublicKey(poolId)),
  ]);

  const aIsWsol = mintA === WSOL_MINT_STR;
  const wsolReserve = aIsWsol ? aBal.value.amount : bBal.value.amount;
  const wsolDecimals = aIsWsol ? aBal.value.decimals : bBal.value.decimals;
  const usdcReserve = aIsWsol ? bBal.value.amount : aBal.value.amount;
  const usdcDecimals = aIsWsol ? bBal.value.decimals : aBal.value.decimals;

  let lp: { mintLp: string; lpDecimals: number; lpSupply: string } | null = null;
  if (poolAccount?.data && poolAccount.data.length >= 341) {
    try {
      lp = parsePoolMintLp(Buffer.from(poolAccount.data));
    } catch {
      lp = null;
    }
  }

  return {
    programId,
    poolId,
    poolAuth,
    mintA,
    mintB,
    vaultA,
    vaultB,
    wsolReserve,
    wsolDecimals,
    usdcReserve,
    usdcDecimals,
    lpMint: lp?.mintLp ?? null,
    lpDecimals: lp?.lpDecimals ?? null,
    lpSupply: lp?.lpSupply ?? null,
  };
}
