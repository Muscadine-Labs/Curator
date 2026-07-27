/**
 * Post-createMarket helpers: dead deposit (inflation protection) + rate seed.
 * @see https://docs.morpho.org/curate/tutorials-market-v1/dead-deposit
 * @see https://docs.morpho.org/curate/tutorials-market-v1/creating-market
 */

import {
  type Address,
  type Hex,
  type PublicClient,
  maxUint256,
  parseAbi,
} from 'viem';
import type { MarketParamsInput } from '@/lib/morpho/blue-create-market';

/** Morpho Blue virtual shares constant (ConstantsLib.VIRTUAL_SHARES). */
export const VIRTUAL_SHARES = 10n ** 6n;
/** Morpho Blue virtual assets (ConstantsLib.VIRTUAL_ASSETS). */
export const VIRTUAL_ASSETS = 1n;
/** Dead deposit size — always 1e9 shares, independent of token decimals. */
export const DEAD_DEPOSIT_SHARES = 10n ** 9n;
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as Address;
/** Morpho oracle price scale (1e36). */
export const ORACLE_PRICE_SCALE = 10n ** 36n;
export const WAD = 10n ** 18n;
/** AdaptiveCurve IRM target utilization (90%). */
export const DEFAULT_SEED_UTILIZATION_BPS = 9000n;

export const morphoBlueMarketAbi = parseAbi([
  'function supply((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)',
  'function withdraw((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn)',
  'function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256 assetsBorrowed, uint256 sharesBorrowed)',
  'function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsRepaid, uint256 sharesRepaid)',
  'function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)',
  'function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)',
  'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
  'function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
]);

export const morphoOraclePriceAbi = parseAbi([
  'function price() view returns (uint256)',
]);

export const erc20ApproveAbi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

/** Shares → assets (round up), mirroring SharesMathLib.toAssetsUp. */
export function toAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  if (shares === 0n) return 0n;
  return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
}

/** Shares → assets (round down), mirroring SharesMathLib.toAssetsDown. */
export function toAssetsDown(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  if (shares === 0n) return 0n;
  return mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
}

function mulDivUp(x: bigint, y: bigint, d: bigint): bigint {
  return (x * y + (d - 1n)) / d;
}

function mulDivDown(x: bigint, y: bigint, d: bigint): bigint {
  return (x * y) / d;
}

export type MarketTotals = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
};

export async function readMarketTotals(
  client: PublicClient,
  morpho: Address,
  marketId: Hex
): Promise<MarketTotals> {
  const row = await client.readContract({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'market',
    args: [marketId],
  });
  return {
    totalSupplyAssets: BigInt(row[0]),
    totalSupplyShares: BigInt(row[1]),
    totalBorrowAssets: BigInt(row[2]),
    totalBorrowShares: BigInt(row[3]),
  };
}

export async function readDeadPositionShares(
  client: PublicClient,
  morpho: Address,
  marketId: Hex
): Promise<bigint> {
  const pos = await client.readContract({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'position',
    args: [marketId, DEAD_ADDRESS],
  });
  return BigInt(pos[0]);
}

/** Assets required to mint `DEAD_DEPOSIT_SHARES` (empty market → 1000 raw units). */
export function deadDepositAssetsNeeded(totals: MarketTotals): bigint {
  return toAssetsUp(
    DEAD_DEPOSIT_SHARES,
    totals.totalSupplyAssets,
    totals.totalSupplyShares
  );
}

/** Default seed supply: 0.001 whole tokens (or 1 unit if decimals < 3). */
export function defaultSeedSupplyAssets(decimals: number): bigint {
  if (decimals >= 3) return 10n ** BigInt(decimals - 3);
  return 1n;
}

export function borrowFromSupply(supplyAssets: bigint, utilBps = DEFAULT_SEED_UTILIZATION_BPS): bigint {
  if (supplyAssets <= 0n) return 0n;
  const borrow = (supplyAssets * utilBps) / 10000n;
  return borrow > 0n ? borrow : 0n;
}

/**
 * Minimum collateral to borrow `borrowAssets` under LLTV + oracle price.
 * Adds `bufferBps` (default 2%) headroom so the position stays healthy.
 */
export function collateralForBorrow(params: {
  borrowAssets: bigint;
  oraclePrice: bigint;
  lltv: bigint;
  bufferBps?: bigint;
}): bigint {
  const { borrowAssets, oraclePrice, lltv, bufferBps = 200n } = params;
  if (borrowAssets <= 0n) return 0n;
  if (oraclePrice <= 0n) throw new Error('Oracle price is zero.');
  if (lltv <= 0n) throw new Error('LLTV must be > 0 to seed a borrow.');

  // collateral * price / ORACLE_PRICE_SCALE * lltv / WAD >= borrow
  // collateral >= borrow * ORACLE_PRICE_SCALE * WAD / (price * lltv)
  const base = mulDivUp(
    mulDivUp(borrowAssets, ORACLE_PRICE_SCALE, oraclePrice),
    WAD,
    lltv
  );
  return mulDivUp(base, 10000n + bufferBps, 10000n);
}

/**
 * Remaining borrow capacity against posted collateral (LLTV − current debt),
 * with a small haircut so the tx does not land exactly on the LLTV edge.
 */
export function maxBorrowAgainstCollateral(params: {
  collateral: bigint;
  oraclePrice: bigint;
  lltv: bigint;
  currentDebtAssets: bigint;
  bufferBps?: bigint;
}): bigint {
  const {
    collateral,
    oraclePrice,
    lltv,
    currentDebtAssets,
    bufferBps = 50n,
  } = params;
  if (collateral <= 0n || oraclePrice <= 0n || lltv <= 0n) return 0n;

  // maxDebt = collateral * price / ORACLE_PRICE_SCALE * lltv / WAD
  const maxDebt = mulDivDown(
    mulDivDown(collateral, oraclePrice, ORACLE_PRICE_SCALE),
    lltv,
    WAD
  );
  const buffered =
    bufferBps >= 10000n ? 0n : maxDebt - (maxDebt * bufferBps) / 10000n;
  if (buffered <= currentDebtAssets) return 0n;
  return buffered - currentDebtAssets;
}

/**
 * Max collateral that can be withdrawn while keeping remaining debt under LLTV
 * (with a small buffer). If debt is 0, returns full collateral.
 */
export function maxWithdrawableCollateral(params: {
  collateral: bigint;
  debtAssets: bigint;
  oraclePrice: bigint;
  lltv: bigint;
  bufferBps?: bigint;
}): bigint {
  const { collateral, debtAssets, oraclePrice, lltv, bufferBps = 50n } = params;
  if (collateral <= 0n) return 0n;
  if (debtAssets <= 0n) return collateral;
  if (oraclePrice <= 0n || lltv <= 0n) return 0n;

  const needed = collateralForBorrow({
    borrowAssets: debtAssets,
    oraclePrice,
    lltv,
    bufferBps,
  });
  if (needed >= collateral) return 0n;
  return collateral - needed;
}

export async function readOraclePrice(
  client: PublicClient,
  oracle: Address
): Promise<bigint> {
  return client.readContract({
    address: oracle,
    abi: morphoOraclePriceAbi,
    functionName: 'price',
  });
}

export async function readErc20Balance(
  client: PublicClient,
  token: Address,
  owner: Address
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: erc20ApproveAbi,
    functionName: 'balanceOf',
    args: [owner],
  });
}

export async function readErc20Allowance(
  client: PublicClient,
  token: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: erc20ApproveAbi,
    functionName: 'allowance',
    args: [owner, spender],
  });
}

export type BootstrapWrite = (config: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}) => Promise<Hex>;

export type WaitReceipt = (hash: Hex) => Promise<unknown>;

async function ensureAllowance(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  token: Address;
  owner: Address;
  spender: Address;
  needed: bigint;
}): Promise<void> {
  const { client, write, wait, token, owner, spender, needed } = params;
  const allowance = await readErc20Allowance(client, token, owner, spender);
  if (allowance >= needed) return;
  if (allowance > 0n && allowance < needed) {
    const resetHash = await write({
      address: token,
      abi: erc20ApproveAbi,
      functionName: 'approve',
      args: [spender, 0n],
    });
    await wait(resetHash);
  }
  const hash = await write({
    address: token,
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [spender, maxUint256],
  });
  await wait(hash);
}

/** Approve loan token (if needed) + supply 1e9 shares to `DEAD_ADDRESS`. */
export async function executeDeadDeposit(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  owner: Address;
  onStep?: (label: string) => void;
}): Promise<{ assetsUsed: bigint }> {
  const {
    client,
    write,
    wait,
    morpho,
    marketId,
    marketParams,
    owner,
    onStep,
  } = params;

  const existing = await readDeadPositionShares(client, morpho, marketId);
  if (existing >= DEAD_DEPOSIT_SHARES) {
    throw new Error('Dead deposit already in place (≥ 1e9 shares).');
  }

  const totals = await readMarketTotals(client, morpho, marketId);
  const assetsNeeded = deadDepositAssetsNeeded(totals);
  if (assetsNeeded <= 0n) {
    throw new Error('Could not compute assets for dead deposit.');
  }

  const balance = await readErc20Balance(client, marketParams.loanToken, owner);
  if (balance < assetsNeeded) {
    throw new Error(
      `Insufficient loan-token balance for dead deposit (need ${assetsNeeded.toString()} raw units).`
    );
  }

  onStep?.('Approving loan token…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.loanToken,
    owner,
    spender: morpho,
    needed: assetsNeeded,
  });

  onStep?.('Supplying dead deposit…');
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'supply',
    args: [marketParams, 0n, DEAD_DEPOSIT_SHARES, DEAD_ADDRESS, '0x'],
  });
  await wait(hash);
  return { assetsUsed: assetsNeeded };
}

/** Supply loan + collateral, then borrow to ~90% utilization of the seed supply. */
export async function executeSeedRate(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketParams: MarketParamsInput;
  owner: Address;
  supplyAssets: bigint;
  borrowAssets: bigint;
  onStep?: (label: string) => void;
}): Promise<{ collateralUsed: bigint }> {
  const {
    client,
    write,
    wait,
    morpho,
    marketParams,
    owner,
    supplyAssets,
    borrowAssets,
    onStep,
  } = params;

  if (supplyAssets <= 0n) throw new Error('Seed supply must be > 0.');
  if (borrowAssets <= 0n) throw new Error('Seed borrow must be > 0.');
  if (borrowAssets >= supplyAssets) {
    throw new Error('Seed borrow must be less than seed supply.');
  }

  const oraclePrice = await readOraclePrice(client, marketParams.oracle);
  const collateralNeeded = collateralForBorrow({
    borrowAssets,
    oraclePrice,
    lltv: marketParams.lltv,
  });

  const loanBal = await readErc20Balance(client, marketParams.loanToken, owner);
  if (loanBal < supplyAssets) {
    throw new Error(
      `Insufficient loan-token balance for seed supply (need ${supplyAssets.toString()} raw).`
    );
  }
  const collBal = await readErc20Balance(
    client,
    marketParams.collateralToken,
    owner
  );
  if (collBal < collateralNeeded) {
    throw new Error(
      `Insufficient collateral balance for seed borrow (need ${collateralNeeded.toString()} raw).`
    );
  }

  onStep?.('Approving loan token…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.loanToken,
    owner,
    spender: morpho,
    needed: supplyAssets,
  });

  onStep?.('Supplying seed liquidity…');
  const supplyHash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'supply',
    args: [marketParams, supplyAssets, 0n, owner, '0x'],
  });
  await wait(supplyHash);

  onStep?.('Approving collateral…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.collateralToken,
    owner,
    spender: morpho,
    needed: collateralNeeded,
  });

  onStep?.('Supplying collateral…');
  const collHash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'supplyCollateral',
    args: [marketParams, collateralNeeded, owner, '0x'],
  });
  await wait(collHash);

  onStep?.('Borrowing to seed rate…');
  const borrowHash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'borrow',
    args: [marketParams, borrowAssets, 0n, owner, owner],
  });
  await wait(borrowHash);

  return { collateralUsed: collateralNeeded };
}

export type UserMarketPosition = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
  /** Withdrawable supply estimate (round down). */
  supplyAssets: bigint;
  /** Debt to clear a full repay (round up). */
  borrowAssetsUp: bigint;
};

export async function readUserMarketPosition(
  client: PublicClient,
  morpho: Address,
  marketId: Hex,
  user: Address
): Promise<UserMarketPosition> {
  const [pos, totals] = await Promise.all([
    client.readContract({
      address: morpho,
      abi: morphoBlueMarketAbi,
      functionName: 'position',
      args: [marketId, user],
    }),
    readMarketTotals(client, morpho, marketId),
  ]);

  const supplyShares = BigInt(pos[0]);
  const borrowShares = BigInt(pos[1]);
  const collateral = BigInt(pos[2]);

  return {
    supplyShares,
    borrowShares,
    collateral,
    supplyAssets: toAssetsDown(
      supplyShares,
      totals.totalSupplyAssets,
      totals.totalSupplyShares
    ),
    borrowAssetsUp: toAssetsUp(
      borrowShares,
      totals.totalBorrowAssets,
      totals.totalBorrowShares
    ),
  };
}

export async function readMarketParamsById(
  client: PublicClient,
  morpho: Address,
  marketId: Hex
): Promise<MarketParamsInput | null> {
  const row = await client.readContract({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'idToMarketParams',
    args: [marketId],
  });
  const loanToken = row[0] as Address;
  if (loanToken.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  return {
    loanToken,
    collateralToken: row[1] as Address,
    oracle: row[2] as Address,
    irm: row[3] as Address,
    lltv: BigInt(row[4]),
  };
}

/** Full repay by borrow shares (Morpho-recommended) + withdraw all collateral. */
export async function executeExitBorrowPosition(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  owner: Address;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketId, marketParams, owner, onStep } =
    params;

  const position = await readUserMarketPosition(client, morpho, marketId, owner);
  if (position.borrowShares === 0n && position.collateral === 0n) {
    throw new Error('No borrow/collateral position to exit.');
  }

  if (position.borrowShares > 0n) {
    // Accrue can increase debt between read and inclusion — approve max; require ~1% buffer.
    const need = position.borrowAssetsUp;
    const needBuffered = need + need / 100n + 1n;
    const bal = await readErc20Balance(client, marketParams.loanToken, owner);
    if (bal < needBuffered) {
      throw new Error(
        `Insufficient loan token to repay (need ~${needBuffered.toString()} raw incl. buffer, have ${bal.toString()}).`
      );
    }
    onStep?.('Approving loan token for repay…');
    await ensureAllowance({
      client,
      write,
      wait,
      token: marketParams.loanToken,
      owner,
      spender: morpho,
      needed: maxUint256,
    });
    onStep?.('Repaying debt…');
    const repayHash = await write({
      address: morpho,
      abi: morphoBlueMarketAbi,
      functionName: 'repay',
      args: [marketParams, 0n, position.borrowShares, owner, '0x'],
    });
    await wait(repayHash);
  }

  const after = await readUserMarketPosition(client, morpho, marketId, owner);
  if (after.collateral > 0n) {
    onStep?.('Withdrawing collateral…');
    const wHash = await write({
      address: morpho,
      abi: morphoBlueMarketAbi,
      functionName: 'withdrawCollateral',
      args: [marketParams, after.collateral, owner, owner],
    });
    await wait(wHash);
  }
}

/** Withdraw loan supply (assets). Pass null assets to withdraw all shares. */
export async function executeWithdrawSupply(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint | null;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketId, marketParams, owner, assets, onStep } =
    params;

  const position = await readUserMarketPosition(client, morpho, marketId, owner);
  if (position.supplyShares === 0n) {
    throw new Error('No supply position to withdraw.');
  }

  onStep?.('Withdrawing supply…');
  if (assets == null) {
    const hash = await write({
      address: morpho,
      abi: morphoBlueMarketAbi,
      functionName: 'withdraw',
      args: [marketParams, 0n, position.supplyShares, owner, owner],
    });
    await wait(hash);
    return;
  }
  if (assets <= 0n) throw new Error('Withdraw amount must be > 0.');
  if (assets > position.supplyAssets) {
    throw new Error('Amount exceeds withdrawable supply.');
  }
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'withdraw',
    args: [marketParams, assets, 0n, owner, owner],
  });
  await wait(hash);
}

/** Add loan supply (assets). */
export async function executeSupplyAssets(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketParams, owner, assets, onStep } = params;
  if (assets <= 0n) throw new Error('Supply amount must be > 0.');

  const bal = await readErc20Balance(client, marketParams.loanToken, owner);
  if (bal < assets) {
    throw new Error(`Insufficient loan-token balance (need ${assets.toString()} raw).`);
  }

  onStep?.('Approving loan token…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.loanToken,
    owner,
    spender: morpho,
    needed: assets,
  });

  onStep?.('Supplying…');
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'supply',
    args: [marketParams, assets, 0n, owner, '0x'],
  });
  await wait(hash);
}

/** Add collateral only (no borrow). */
export async function executeAddCollateral(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketParams, owner, assets, onStep } = params;
  if (assets <= 0n) throw new Error('Collateral amount must be > 0.');

  const bal = await readErc20Balance(client, marketParams.collateralToken, owner);
  if (bal < assets) {
    throw new Error(`Insufficient collateral balance (need ${assets.toString()} raw).`);
  }

  onStep?.('Approving collateral…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.collateralToken,
    owner,
    spender: morpho,
    needed: assets,
  });

  onStep?.('Supplying collateral…');
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'supplyCollateral',
    args: [marketParams, assets, owner, '0x'],
  });
  await wait(hash);
}

/** Borrow loan assets against existing collateral (receiver = owner). */
export async function executeBorrowAssets(params: {
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { write, wait, morpho, marketParams, owner, assets, onStep } = params;
  if (assets <= 0n) throw new Error('Borrow amount must be > 0.');

  onStep?.('Borrowing…');
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'borrow',
    args: [marketParams, assets, 0n, owner, owner],
  });
  await wait(hash);
}

/**
 * Repay debt. Pass `assets: null` to repay all borrow shares (Morpho-recommended).
 * Pass a positive `assets` amount for a partial repay.
 */
export async function executeRepayDebt(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint | null;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketId, marketParams, owner, assets, onStep } =
    params;

  const position = await readUserMarketPosition(client, morpho, marketId, owner);
  if (position.borrowShares === 0n) {
    throw new Error('No debt to repay.');
  }

  if (assets == null) {
    const need = position.borrowAssetsUp;
    const needBuffered = need + need / 100n + 1n;
    const bal = await readErc20Balance(client, marketParams.loanToken, owner);
    if (bal < needBuffered) {
      throw new Error(
        `Insufficient loan token to repay (need ~${needBuffered.toString()} raw incl. buffer, have ${bal.toString()}).`
      );
    }
    onStep?.('Approving loan token for repay…');
    await ensureAllowance({
      client,
      write,
      wait,
      token: marketParams.loanToken,
      owner,
      spender: morpho,
      needed: maxUint256,
    });
    onStep?.('Repaying all debt…');
    const repayHash = await write({
      address: morpho,
      abi: morphoBlueMarketAbi,
      functionName: 'repay',
      args: [marketParams, 0n, position.borrowShares, owner, '0x'],
    });
    await wait(repayHash);
    return;
  }

  if (assets <= 0n) throw new Error('Repay amount must be > 0.');
  const bal = await readErc20Balance(client, marketParams.loanToken, owner);
  if (bal < assets) {
    throw new Error(`Insufficient loan token to repay (need ${assets.toString()} raw).`);
  }

  onStep?.('Approving loan token for repay…');
  await ensureAllowance({
    client,
    write,
    wait,
    token: marketParams.loanToken,
    owner,
    spender: morpho,
    needed: assets,
  });

  onStep?.('Repaying debt…');
  const repayHash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'repay',
    args: [marketParams, assets, 0n, owner, '0x'],
  });
  await wait(repayHash);
}

/**
 * Withdraw collateral. Pass `assets: null` to withdraw all posted collateral
 * (requires debt already cleared, or Morpho will revert if still unhealthy).
 */
export async function executeWithdrawCollateral(params: {
  client: PublicClient;
  write: BootstrapWrite;
  wait: WaitReceipt;
  morpho: Address;
  marketId: Hex;
  marketParams: MarketParamsInput;
  owner: Address;
  assets: bigint | null;
  onStep?: (label: string) => void;
}): Promise<void> {
  const { client, write, wait, morpho, marketId, marketParams, owner, assets, onStep } =
    params;

  const position = await readUserMarketPosition(client, morpho, marketId, owner);
  if (position.collateral === 0n) {
    throw new Error('No collateral to withdraw.');
  }

  const amount = assets == null ? position.collateral : assets;
  if (amount <= 0n) throw new Error('Withdraw amount must be > 0.');
  if (amount > position.collateral) {
    throw new Error('Amount exceeds posted collateral.');
  }

  onStep?.('Withdrawing collateral…');
  const hash = await write({
    address: morpho,
    abi: morphoBlueMarketAbi,
    functionName: 'withdrawCollateral',
    args: [marketParams, amount, owner, owner],
  });
  await wait(hash);
}
