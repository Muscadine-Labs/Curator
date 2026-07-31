import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  parseAbiItem,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem';
import { vaultV2Abi } from '@/lib/onchain/abis';

const MARKET_PARAMS_ABI = parseAbiParameters(
  'address, address, address, address, uint256'
);

const MARKET_CAP_ID_DATA_ABI = parseAbiParameters(
  'string, address, (address,address,address,address,uint256)'
);

const SET_IS_ALLOCATOR_ABI = parseAbiItem(
  'function setIsAllocator(address account, bool newIsAllocator)'
);

export type DecodedMarketParams = {
  /** Morpho Blue market id = keccak256(abi.encode(marketParams)). */
  marketId: Hex;
  loanAsset: Address;
  collateralAsset: Address;
  oracle: Address;
  irm: Address;
  lltv: string;
};

export type DecodedAllocationLeg = {
  kind: 'allocate' | 'deallocate';
  adapterAddress: Address;
  assets: string;
  market: DecodedMarketParams | null;
};

export type DecodedLiquiditySwitch = {
  adapterAddress: Address;
  liquidityData: Hex;
  market: DecodedMarketParams | null;
};

export type DecodedCapChange = {
  kind: 'decreaseAbsoluteCap' | 'decreaseRelativeCap';
  newCap: string;
  adapterAddress: Address | null;
  market: DecodedMarketParams | null;
  capKind: 'adapter' | 'collateral' | 'market' | 'unknown';
  collateralAddress: Address | null;
};

export type DecodedRoleChange = {
  kind: 'setIsAllocator' | 'revoke';
  account: Address | null;
  isAllocator: boolean | null;
};

export type DecodedVaultCallSummary = {
  hasAllocate: boolean;
  hasDeallocate: boolean;
  /** True for sentinel-only vault writes: cap decrease, revoke pending, remove allocator. */
  hasSentinelAction: boolean;
  liquiditySwitch: DecodedLiquiditySwitch | null;
  allocationLegs: DecodedAllocationLeg[];
  capChanges: DecodedCapChange[];
  roleChanges: DecodedRoleChange[];
};

export function decodeMarketParamsData(data: Hex): DecodedMarketParams | null {
  try {
    const [loan, col, ora, irmAddr, lltvRaw] = decodeAbiParameters(
      MARKET_PARAMS_ABI,
      data
    );
    return {
      marketId: keccak256(data),
      loanAsset: loan,
      collateralAsset: col,
      oracle: ora,
      irm: irmAddr,
      lltv: lltvRaw.toString(),
    };
  } catch {
    return null;
  }
}

function marketFromTuple(
  loan: Address,
  col: Address,
  ora: Address,
  irmAddr: Address,
  lltvRaw: bigint
): DecodedMarketParams {
  const data = encodeAbiParametersFromTuple(loan, col, ora, irmAddr, lltvRaw);
  return {
    marketId: keccak256(data),
    loanAsset: loan,
    collateralAsset: col,
    oracle: ora,
    irm: irmAddr,
    lltv: lltvRaw.toString(),
  };
}

function encodeAbiParametersFromTuple(
  loan: Address,
  col: Address,
  ora: Address,
  irmAddr: Address,
  lltvRaw: bigint
): Hex {
  return encodeAbiParameters(MARKET_PARAMS_ABI, [loan, col, ora, irmAddr, lltvRaw]);
}

/** Decode cap idData from decreaseAbsoluteCap / decreaseRelativeCap. */
export function decodeCapIdData(idData: Hex): {
  adapterAddress: Address | null;
  market: DecodedMarketParams | null;
  capKind: DecodedCapChange['capKind'];
  collateralAddress: Address | null;
} {
  try {
    const [tag, addr] = decodeAbiParameters(parseAbiParameters('string, address'), idData);
    if (tag === 'this') {
      return {
        adapterAddress: addr,
        market: null,
        capKind: 'adapter',
        collateralAddress: null,
      };
    }
    if (tag === 'collateralToken') {
      return {
        adapterAddress: null,
        market: null,
        capKind: 'collateral',
        collateralAddress: addr,
      };
    }
  } catch {
    // fall through
  }

  try {
    const [tag, adapter, params] = decodeAbiParameters(MARKET_CAP_ID_DATA_ABI, idData);
    if (tag === 'this/marketParams') {
      const [loan, col, ora, irmAddr, lltvRaw] = params as readonly [
        Address,
        Address,
        Address,
        Address,
        bigint,
      ];
      return {
        adapterAddress: adapter,
        market: marketFromTuple(loan, col, ora, irmAddr, lltvRaw),
        capKind: 'market',
        collateralAddress: null,
      };
    }
  } catch {
    // fall through
  }

  return {
    adapterAddress: null,
    market: null,
    capKind: 'unknown',
    collateralAddress: null,
  };
}

/**
 * Decode Vault V2 allocate / deallocate / setLiquidityAdapterAndData from
 * raw tx input (direct call or multicall).
 */
export function decodeVaultV2Calldata(data: Hex | undefined | null): DecodedVaultCallSummary {
  const empty: DecodedVaultCallSummary = {
    hasAllocate: false,
    hasDeallocate: false,
    hasSentinelAction: false,
    liquiditySwitch: null,
    allocationLegs: [],
    capChanges: [],
    roleChanges: [],
  };
  if (!data || data === '0x') return empty;

  const inspect = (calldata: Hex): void => {
    try {
      const decoded = decodeFunctionData({
        abi: vaultV2Abi,
        data: calldata,
      });
      if (decoded.functionName === 'allocate') {
        empty.hasAllocate = true;
        const [adapter, marketData, assets] = decoded.args as [Address, Hex, bigint];
        empty.allocationLegs.push({
          kind: 'allocate',
          adapterAddress: adapter,
          assets: assets.toString(),
          market: decodeMarketParamsData(marketData),
        });
      } else if (decoded.functionName === 'deallocate') {
        empty.hasDeallocate = true;
        const [adapter, marketData, assets] = decoded.args as [Address, Hex, bigint];
        empty.allocationLegs.push({
          kind: 'deallocate',
          adapterAddress: adapter,
          assets: assets.toString(),
          market: decodeMarketParamsData(marketData),
        });
      } else if (decoded.functionName === 'decreaseAbsoluteCap') {
        empty.hasSentinelAction = true;
        const [idData, newCap] = decoded.args as [Hex, bigint];
        const capMeta = decodeCapIdData(idData);
        empty.capChanges.push({
          kind: 'decreaseAbsoluteCap',
          newCap: newCap.toString(),
          adapterAddress: capMeta.adapterAddress,
          market: capMeta.market,
          capKind: capMeta.capKind,
          collateralAddress: capMeta.collateralAddress,
        });
      } else if (decoded.functionName === 'decreaseRelativeCap') {
        empty.hasSentinelAction = true;
        const [idData, newCap] = decoded.args as [Hex, bigint];
        const capMeta = decodeCapIdData(idData);
        empty.capChanges.push({
          kind: 'decreaseRelativeCap',
          newCap: newCap.toString(),
          adapterAddress: capMeta.adapterAddress,
          market: capMeta.market,
          capKind: capMeta.capKind,
          collateralAddress: capMeta.collateralAddress,
        });
      } else if (decoded.functionName === 'setLiquidityAdapterAndData') {
        const [adapter, liqData] = decoded.args as [Address, Hex];
        empty.liquiditySwitch = {
          adapterAddress: adapter,
          liquidityData: liqData,
          market: decodeMarketParamsData(liqData),
        };
      } else if (decoded.functionName === 'revoke') {
        // Sentinel can revoke pending timelocked actions.
        empty.hasSentinelAction = true;
        empty.roleChanges.push({
          kind: 'revoke',
          account: null,
          isAllocator: null,
        });
      } else if (decoded.functionName === 'submit') {
        const [inner] = decoded.args as [Hex];
        inspect(inner);
      } else if (decoded.functionName === 'multicall') {
        const [calls] = decoded.args as [readonly Hex[]];
        for (const inner of calls) {
          inspect(inner);
        }
      }
    } catch {
      // ignore undecodable vault ABI chunks
    }

    try {
      const roleDecoded = decodeFunctionData({
        abi: [SET_IS_ALLOCATOR_ABI],
        data: calldata,
      });
      if (roleDecoded.functionName === 'setIsAllocator') {
        const [account, isAllocator] = roleDecoded.args as [Address, boolean];
        // Only removing an allocator is a sentinel-style risk-off action.
        // Granting is owner/curator and must not route to the sentinel panel.
        if (!isAllocator) {
          empty.hasSentinelAction = true;
        }
        empty.roleChanges.push({
          kind: 'setIsAllocator',
          account: getAddress(account),
          isAllocator,
        });
      }
    } catch {
      // not a setIsAllocator call
    }
  };

  inspect(data);
  return empty;
}

export function isHexAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value));
}

export function normalizeAddress(value: string): Address {
  return getAddress(value);
}
