# Ball vs Ball

A pixel-art take on the Roblox game *Ball vs Ball*. Open `index.html` in a browser.

- Aim with the mouse and click (or press Space) to launch your ball.
- Balls bounce around the square arena. When two balls touch, each one damages the other.
- Click a side panel (or press 1 / 2) before launching to swap that side's ball.
- Press R to restart.

## Balls

| Ball | HP | Damage per hit |
| --- | --- | --- |
| Normal Ball | 100 | 8–12 |
| Axe Ball | 100 | 1 from the ball, 10–14 from the axe |

The Axe Ball's axe orbits around it and spins faster the longer the ball stays alive.
When two axes meet they clang off each other and both reverse direction.

New balls go in the `BALL_TYPES` table in `index.html`.
