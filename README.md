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

The Axe Ball's axe orbits around it and spins faster the longer the ball stays alive.
When two axes meet they clang off each other and both reverse direction.

The Spider Ball starts a web strand when it touches a wall. When it then touches a different wall, the web is set
between the two spots. An enemy that touches a set web is stuck in place for 3 seconds, then breaks free and the web
snaps. Each Spider Ball can have 2 webs out at a time, and each web lasts 10 seconds.

New balls go in the `BALL_TYPES` table in `index.html`.

The RNG Ball rolls a number from 1 to 35. Each roll takes 1.5 seconds, and it deals no damage while rolling. Once the
number lands, its next hit deals exactly that much, which uses up the number and starts the next roll. The current
number shows in a box above the ball.

The Execute Ball barely does damage, but if one of its hits leaves the enemy under 20% HP, the enemy is executed on the
spot. When you face it, a purple tick on your health bar marks the 20% line.

The Tank Ball is a grey armored ball. When its HP drops to 100, a shield comes up for the rest of the fight and halves
all damage it takes. Its own damage also goes up 50%, from 5 to 8 per hit.
