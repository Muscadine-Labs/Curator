# Markets Page Structure

## Date: November 7, 2024

---

## ✅ New Structure (As Requested)

The `/markets` page now displays **each vault immediately followed by its own markets table**:

```
┌─────────────────────────────────────────────────────────────┐
│                     USDC VAULT CARD                          │
│ - Total Supplied, Utilization, Reward APR, Market Count     │
│ - Curator Rating (0-100)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 USDC VAULT MARKETS TABLE                     │
│ Market Pair | LLTV | Supplied | Util | APR | Rating | Info │
│ Market 1    | 86.00% | $X.XXM | XX% | X% | Prime·87 | ...  │
│ Market 2    | 94.50% | $X.XXM | XX% | X% | Prime·85 | ...  │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    cbBTC VAULT CARD                          │
│ - Total Supplied, Utilization, Reward APR, Market Count     │
│ - Curator Rating (0-100)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                cbBTC VAULT MARKETS TABLE                     │
│ Market Pair | LLTV | Supplied | Util | APR | Rating | Info │
│ Market 1    | 86.00% | $X.XXM | XX% | X% | Prime·85 | ...  │
│ Market 2    | 77.00% | $X.XXM | XX% | X% | Balanced·82 | ..│
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WETH VAULT CARD                           │
│ - Total Supplied, Utilization, Reward APR, Market Count     │
│ - Curator Rating (0-100)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 WETH VAULT MARKETS TABLE                     │
│ Market Pair | LLTV | Supplied | Util | APR | Rating | Info │
│ Market 1    | 86.00% | $X.XXM | XX% | X% | Prime·88 | ...  │
│ Market 2    | 94.50% | $X.XXM | XX% | X% | Prime·86 | ...  │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RATINGS DIGEST                           │
│ Quick overview of all markets sorted by rating              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Structure Breakdown

### For Each Vault:

#### 1. **Vault Summary Card**
- Vault name with asset badge (USDC/cbBTC/WETH)
- Description
- **Curator rating badge** (0-100 scale)
- 4 Key Metrics:
  - Total Supplied (USD)
  - Average Utilization (%)
  - Total Reward APR (%)
  - Number of Markets
- Color-coded border:
  - USDC: Emerald (`border-emerald-500/20`)
  - cbBTC: Orange (`border-orange-500/20`)
  - WETH: Blue (`border-blue-500/20`)

#### 2. **Vault Markets Table** (Immediately Below Vault Card)
- **Title**: "{ASSET} Vault Markets"
- **Description**: "Markets where the {Vault Name} is actively supplying capital"
- **Columns**:
  1. **Market Pair** - Collateral/Loan symbols
  2. **LLTV** - Liquidation Loan-to-Value at 2 decimals (86.00%)
  3. **Supplied USD** - Amount supplied to this market
  4. **Utilization** - Market utilization percentage
  5. **Reward APR** - Supply reward APR (green text)
  6. **Curator Rating** - 0-100 rating with color badge
  7. **Borrowing** - Description (e.g., "cbBTC → USDC borrow")

- **Empty State**: "No active markets for this vault" (if applicable)

---

## 🎯 Key Features

### 1. **Vault-Centric Organization**
- Each vault is a self-contained unit
- Markets are clearly associated with their parent vault
- Easy to see exactly what each vault is supplying to

### 2. **Comprehensive Market Info**
- **LLTV at 2 decimals** (86.00% not 86.0%)
- **Curator ratings (0-100)** with color-coded badges
- Supply amounts, utilization, and reward APR
- Clear borrowing relationship descriptions

### 3. **Visual Hierarchy**
- 12px spacing between vault sections (`space-y-12`)
- 6px spacing between vault card and its markets table (`space-y-6`)
- Color-coded borders for quick vault identification
- Consistent table styling across all vaults

### 4. **Ratings Digest** (Bottom)
- Overview of all markets from all vaults
- Sorted by rating (highest to lowest)
- Quick reference for comparing ratings across vaults

---

## 📊 Data Display

### Market Table Columns Explained:

1. **Market Pair**
   - Format: `Collateral / Loan`
   - Example: `cbBTC / USDC`
   - Font: Medium weight for emphasis

2. **LLTV (2 decimals)**
   - Format: `XX.XX%`
   - Example: `86.00%`
   - Purpose: Liquidation threshold

3. **Supplied USD**
   - Format: Compact USD (`$X.XXM`)
   - Shows how much this vault has supplied to the market
   - Uses `formatCompactUSD()` helper

4. **Utilization**
   - Format: `XX.XX%`
   - Shows market utilization rate
   - 2 decimal precision

5. **Reward APR**
   - Format: `X.XX%`
   - Color: Green (`text-green-600 dark:text-green-400`)
   - Shows supply reward APR
   - Displays `—` if no rewards

6. **Curator Rating**
   - Format: Badge with tier + number
   - Examples: `Prime·87`, `Balanced·75`, `Watch·60`
   - Color-coded by tier:
     - Prime (85-100): Emerald
     - Balanced (70-84): Sky blue
     - Watch (55-69): Amber
     - High Risk (0-54): Rose

7. **Borrowing**
   - Format: `Collateral → Loan borrow`
   - Example: `cbBTC → USDC borrow`
   - Clarifies the lending relationship

---

## 🔧 Technical Implementation

### Vault Loop Structure:
```typescript
{vaultSummaries.map((vaultSummary) => (
  <div key={vaultSummary.vault.id} className="space-y-6">
    {/* Vault Card */}
    <Card className={borderColor}>
      {/* Stats, rating, metrics */}
    </Card>

    {/* Markets Table */}
    <Card>
      <Table>
        {vaultSummary.markets.map((market) => (
          <TableRow>
            {/* Market data with LLTV at 2 decimals and rating */}
          </TableRow>
        ))}
      </Table>
    </Card>
  </div>
))}
```

### Data Flow:
```
1. Fetch Morpho markets (ratings)
2. Fetch supplied markets (allocations)
3. Merge by uniqueKey
4. Group by vault
5. Render: Vault Card → Markets Table → Next Vault
```

---

## ✅ What Changed

### Before:
- All 3 vault cards at top
- Combined markets table (all vaults mixed)
- Separate cbBTC/WETH summary cards
- Ratings digest

### After:
- USDC Vault Card → USDC Markets Table
- cbBTC Vault Card → cbBTC Markets Table
- WETH Vault Card → WETH Markets Table
- Ratings digest

### Benefits:
✅ **Clearer organization** - Markets immediately follow their vault  
✅ **Easier to scan** - See what each vault supplies to  
✅ **Better context** - Each vault is self-contained  
✅ **Less redundancy** - Removed duplicate cbBTC/WETH sections  

---

## 📱 Responsive Design

### Mobile (< 640px):
- Tables scroll horizontally
- Vault cards stack vertically
- Stats grid: 1 column
- Full table functionality preserved

### Tablet (640px - 1024px):
- Stats grid: 2 columns
- Tables scroll if needed
- Comfortable spacing

### Desktop (1024px+):
- Stats grid: 4 columns across
- Tables display fully
- Optimal spacing (12px between vaults)

---

## 🎨 Styling Details

### Vault Card Colors:
```typescript
const borderColor = 
  vault.asset === 'USDC'  ? 'border-emerald-500/20' :
  vault.asset === 'cbBTC' ? 'border-orange-500/20'  :
  'border-blue-500/20'; // WETH
```

### Table Styling:
- Header: Uppercase, small text, tracking-wide
- Rows: Hover effect (`hover:bg-muted/40`)
- Cells: Min-widths to prevent cramping
- Rating badges: Full component with colors

### Spacing:
- Between vaults: 12 spacing units (`space-y-12`)
- Vault card to table: 6 spacing units (`space-y-6`)
- Inside cards: Standard padding

---

## 🚀 Build Status

```bash
✓ Compiled successfully in 4.2s
✓ Linter: Clean (no errors)
✓ TypeScript: No errors
✓ Bundle: 6.34 kB (optimized)
```

**Status**: ✅ **PRODUCTION READY**

---

## 📋 Example Output

### Muscadine USDC Vault Section:

**Vault Card:**
```
┌──────────────────────────────────────────────────┐
│ Muscadine USDC Vault        [USDC]    [Prime·87]│
│ USDC yield vault with low risk strategy          │
├──────────────────────────────────────────────────┤
│ Total: $2.5M  Util: 75.23%  APR: 4.50%  Mkts: 3 │
└──────────────────────────────────────────────────┘
```

**Markets Table:**
```
┌──────────────────────────────────────────────────────────────────┐
│ USDC Vault Markets                                               │
├──────────┬────────┬───────────┬──────┬─────┬─────────┬──────────┤
│ Pair     │ LLTV   │ Supplied  │ Util │ APR │ Rating  │ Borrowing│
├──────────┼────────┼───────────┼──────┼─────┼─────────┼──────────┤
│ cbBTC/   │ 86.00% │ $1.2M     │ 80%  │ 5%  │ Prime·87│ cbBTC→   │
│ USDC     │        │           │      │     │         │ USDC     │
├──────────┼────────┼───────────┼──────┼─────┼─────────┼──────────┤
│ WETH/    │ 94.50% │ $800K     │ 70%  │ 4%  │ Prime·85│ WETH→    │
│ USDC     │        │           │      │     │         │ USDC     │
└──────────┴────────┴───────────┴──────┴─────┴─────────┴──────────┘
```

---

## ✅ Requirements Met

- [x] Each vault followed by its markets table
- [x] LLTV at 2 decimals (86.00%)
- [x] All market info displayed (LLTV, supplied, utilization, APR)
- [x] Curator ratings (0-100) with color badges
- [x] Clear borrowing relationships
- [x] Vault addresses correct
- [x] APY from Morpho API
- [x] Base network only (8453)
- [x] Responsive design
- [x] Build passes
- [x] No errors

---

**Last Updated**: November 7, 2024  
**Structure**: ✅ Vault → Markets → Vault → Markets → Vault → Markets  
**Build**: ✅ Passing  
**Production**: ✅ Ready

