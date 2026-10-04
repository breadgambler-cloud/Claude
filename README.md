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

The Axe Ball's axe orbits around it and spins faster the longer the ball stays alive.
When two axes meet they clang off each other and both reverse direction.

New balls go in the `BALL_TYPES` table in `index.html`.
