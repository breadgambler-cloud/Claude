# Ball vs Ball

A pixel-art take on the Roblox game *Ball vs Ball*. Open `index.html` in a browser.

- Pick your ball (click a card or press its number). The CPU picks a random ball.
- Aim with the mouse and click (or press Space) to launch. The farther the cursor is from your ball, the harder the launch.
- Balls bounce around the square arena. Every contact is one tick of each ball's damage stat.
- Collisions use momentum, so speeds change after impacts. Faster balls ricochet into each other more often.
- First hit: in a collision, the ball driving in harder strikes first. If that knocks the other ball out, it never hits back.
- After a round, click to pick again, or press R for a rematch with the same balls.

## Balls

| Ball | HP | Damage per hit |
| --- | --- | --- |
| Normal Ball | 100 | 10 |
| Axe Ball | 100 | 1 from the ball, 12 from the axe |
| Spider Ball | 100 | 8 |
| RNG Ball | 100 | its last roll, 1–35 |
| Execute Ball | 200 | 5–9 |
| Tank Ball | 200 | 5 |
| Spike Ball | 100 | 4, spikes 4 (medium) or 7 (big) |
| Vampire Ball | 100 | 0, bites drain 8 HP per second |
| Bomb Ball | 100 | 3, every bomb 15 |
| Ghost Ball | 100 | 9 |
| Lightning Ball | 100 | 4, zap 6 |
| Ice Ball | 100 | 7 |
| Shocker Ball | 100 | 7, shock 6 |

The Axe Ball's axe orbits around it and spins faster the longer the ball stays alive.
When two axes meet they clang off each other and both reverse direction.

The Spider Ball starts a web strand when it touches a wall. When it then touches a different wall, the web is set
between the two spots. An enemy that touches a set web takes 1 damage (at most every 0.3 seconds while touching).
Each Spider Ball can have 5 webs out at a time, and each web lasts 10 seconds.

New balls go in the `BALL_TYPES` table in `index.html`.

The RNG Ball rolls a number from 1 to 35. Each roll takes 1.5 seconds, and it deals no damage while rolling. Once the
number lands, its next hit deals exactly that much, which uses up the number and starts the next roll. The current
number shows in a box above the ball.

The Execute Ball barely does damage, but if one of its hits leaves the enemy under 20% HP, the enemy is executed on the
spot. When you face it, a purple tick on your health bar marks the 20% line.

The Tank Ball is a grey armored ball. When its HP drops to 100, a shield comes up for the rest of the fight and halves
all damage it takes. Its own damage also goes up 50%, from 5 to 8 per hit.

Every time the Spike Ball hits a wall, a spike (medium or big) grows out of that spot. Enemies bounce off spikes and
take damage. Each Spike Ball can have 10 spikes at a time.

The Vampire Ball turns to face the enemy. If its fangs touch the enemy, it latches on for 2 seconds, draining 4 HP every
half second and healing itself by the same amount. Biting is the only way it does damage. After a bite it needs
1.5 seconds before it can bite again.

The Bomb Ball's fuse burns down every 4 seconds and it explodes, dealing 15 damage and knockback to any enemy in the blast.
Every 1–2 seconds it also drops a mini bomb at a random spot on the map (up to 6 at a time). A mini bomb
blinks for 2 seconds, showing a ring for its huge blast radius, then explodes for 15 damage and big knockback.

The Ghost Ball is solid for 3 seconds, then fades for 1.5 seconds. While faded it passes through everything and can't be
hurt by anything: hits, axes, spikes, webs, bites, blasts or lightning.

The Lightning Ball strikes the enemy with lightning every 3 seconds for 6 damage, wherever they are in the arena.

The Ice Ball's hits chill the enemy, who moves at half speed for 2 seconds.

The Shocker Ball charges up with blue electricity for 1.5 seconds, every 3 seconds. If the enemy hits it while it's
charged (body, axe or bite), the enemy takes 6 damage and is stunned for 1.5 seconds: frozen in place and unable to
deal any damage.
