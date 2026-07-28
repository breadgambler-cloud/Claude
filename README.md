# Claude

## ⛏️ Mutant Ore Tycoon

A single-file idle/tycoon game — open `index.html` in any browser. No build step, no
dependencies, no network. Progress auto-saves to `localStorage`.

### Mechanics

- **10 ore tiers** — 🪵 Wood → 🪨 Stone → 🥉 Copper → ⚙️ Iron → 🥈 Silver → 🥇 Gold →
  💎 Diamond → 🔮 Mythril → ☄️ Starstone → 🌌 Voidstone. Towers mine their tier
  automatically into your vault.
- **Merging** — drag one tower onto another of the same tier (or use the 🔀 Merge button)
  to fuse them into the next tier. **The better mutation of the two always carries over** —
  a merge can never lose or downgrade a mutation — and 25% of the time it evolves one rank
  further. In merge mode every valid partner shows a badge with the exact result. Traits
  are inherited from both parents.
- **Upgrading** — coins raise a tower's level, which raises its harvest speed.
- **15 mutations** — ✨ Gleaming, 🔥 Burning, ⚡ Charged, ❄️ Frozen, 🍀 Lucky,
  ☢️ Radioactive, 🦠 Viral, 💠 Crystalline, ⚗️ Alchemical, 🩸 Bloodied, 🌈 Rainbow,
  🌑 Void, 🌟 Stellar, 👑 Regal, 🕳️ Singularity. Each scales a tower's value and speed.
  Mutated towers produce mutated ore, stored and sold separately at a markup. A tower only
  ever accepts a *better* mutation.
- **Mutation Chamber** — **Inject Serum** forces a mutation roll on one tower (it can only
  improve; a worse roll wastes the serum). **Splice** moves a better mutation off a donor
  tower, dissolving the donor — the way to rescue a great mutation from a junk tower.
- **16 daily events** — one fires at the end of every in-game day (90s): Meteor Shower,
  Rainbow Rain, Thunderstorm, Blood Moon, Market Boom, Traveling Merchant, Void Rift,
  Dragon's Hoard, Volcanic Eruption, Gene Storm, Cursed Auction, Alchemist's Visit, Solar
  Flare, Quiet Day, Ore Rush, Four-Leaf Fortune. Most roll mutations across your mine;
  others buff speed, sell price, or luck for the day.
- **10 forge traits** (3 per tower, up to 5 with the Trait Matrix) — ⚡ Swift, 💰 Greedy,
  🌱 Fertile, 🔮 Arcane, 🍀 Fortunate, 🔗 Symbiotic, 🌟 Prodigy, ⏳ Timeless, 💎 Refined,
  ♾️ Eternal. Forging costs coins plus raw ore of the tower's own tier.
- **Refining** — turn 6 ore into 1 of the next tier up, *keeping the mutation*. Lossy in
  coins, but the only way to get high-tier ore for forging before you own a high-tier tower.
- **Totem Merchant** — a trader separate from the store, whose stock rotates every day.
  Alongside plain totems and twin packs, they carve **Rare** and **Legendary** totems that
  arrive pre-mutated and carry six **merchant-exclusive traits the forge never offers**:
  🗿 Stoneheart, 🪬 Warded, 🐲 Hoarder, 👁️ All-Seeing, ☀️ Radiant, ⛓️ Entropic (huge speed,
  but that totem can never be merged). Stock is gated to roughly your current tier, can be
  refreshed for coins, and 🎁 Traveling Merchant days bring rare-heavy stock at 30% off.
- **18 achievements** — each grants a small permanent bonus to speed, sell value or
  mutation luck, plus a mutation codex tracking which of the 15 you've discovered. Both
  survive retirement.
- **Store** — sapling towers, four crate tiers, and permanent upgrades (plot expansion,
  harvest speed, sell value, mutation luck, trait slots, auto-seller, and an auto-merger
  that only ever fuses plain towers — it will never touch a mutated or forged one).
- **Prestige** — retire for Legacy Shards: +5% harvest speed and +3% sell value each,
  permanently.
- **Offline progress** — the mine runs at half speed while you're away, up to 8 hours,
  and the last few days still fire their events so you return to fresh mutations.
