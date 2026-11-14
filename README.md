# Froggy Dash

Create a mobile-first browser game (endless runner) in React + TypeScript using a single HTML5 canvas. The game fills the screen on mobile and scales responsively.

Gameplay: a frog runs on the ground at the left side. Obstacles spawn from the right and move left. The frog jumps when the user taps anywhere on the screen (also support Space for desktop). Implement gravity, jump strength, and prevent double-jumps (only jump when on ground).

Mechanics: use requestAnimationFrame for the game loop. Spawn obstacles at random intervals (e.g., 900–1600ms) and gradually increase difficulty by slowly increasing obstacle speed and slightly decreasing spawn interval over time. Remove off-screen obstacles.

Collision: simple rectangle hitboxes (AABB). On collision, stop the loop and show a “Game Over” overlay with score, best score (saved in localStorage), and a Restart button. Also show a Start overlay initially with “Tap to start.”

UI: Score in top-left, Best in top-right. Use minimal clean styling. No external assets; draw simple shapes (frog as a green rounded rectangle/circle + eyes; obstacles as dark rectangles).

Touch handling: prevent page scrolling/zoom during play, and ensure tap works reliably on iOS Safari. Use pointer events and set canvas style touch-action: none.

Provide all code in a single component plus any small helpers, and include clear comments.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://frugrun.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c4c4431-2c28-4532-838c-e9b8973b3f68).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
