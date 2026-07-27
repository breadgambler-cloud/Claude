# OUTLINE — a pixel-art boss rush

You are a **black circle with a red outline**. Fight a gauntlet of geometric
bosses — each one a black shape with a thick neon outline and its own set of
attacks. Collect coins and XP as you dodge, then spend them in the shop
between fights.

**Play it:** open `index.html` in any modern browser. No build step, no
dependencies, no server required.

## Controls

| Action | Keys |
| --- | --- |
| Move | `WASD` / Arrow keys |
| Aim & shoot | Mouse (hold to fire) |
| Pause | `P` |
| Mute | `M` |

On touch screens: drag to move and aim, hold to fire.

## The bosses

Each boss is a black shape with a thick colored outline and a unique attack
kit. Every boss enters an enraged **phase 2** at 50% HP (faster, denser
patterns).

1. **ORB** (circle, red) — bullet-hell rings & spirals, summons chasing minions.
2. **BLOCK** (square, green) — rotating lasers, shockwave slams, bouncing minions, tracking spreads.
3. **DELTA** (triangle, yellow) — charges/dashes leaving bullet trails, aimed spreads, spinning arms.
4. **PRISM** (pentagon, purple) — orbiting bullet rings, beams from every vertex, homing shards.
5. **NOVA** (star, orange) — the finale: flower patterns, sweeping beams, summons and homing combined.

## Progression

- **Coins ◈** — dropped by bosses and minions; the shop currency.
- **XP** — fills a level bar. Leveling up raises max HP, heals you, and boosts damage.
- **Shop** — between every boss: buy Damage, Fire Rate, Move Speed, Max HP,
  Multishot, Pierce, Bullet Speed, Magnet range, or a quick Repair. Costs scale
  each time you buy the same upgrade.

## Under the hood

Pure vanilla HTML/CSS/JS. The game renders to a 240×240 canvas that CSS scales
up with crisp (pixelated) rendering for the chunky low-res look. Sound is
generated live with a tiny WebAudio square-wave blip engine — no asset files.

- `index.html` — page + menu/shop/ending overlays
- `style.css` — arcade UI styling
- `game.js` — the whole engine: input, player, bosses, bullets, lasers,
  pickups, particles, shop, and the game loop
