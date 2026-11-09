# Architecture
- Keep gameplay in the existing canvas runner with fixed-step simulation and interpolated rendering; HUD updates are throttled to avoid per-frame React work.
- Keep playlist playback in a separate audio module so replay and menu transitions cannot recreate or restart the music.
- Use a fixed logical game height and orientation-specific view width with uniform scaling, so physics and sprite sizes are independent of display pixels.
- Normalize sprite frames and derive alpha-based geometry once at preload; share pose transforms and rendered swept collision shapes with debug guides so visible and physical anchors cannot diverge.
- Keep the swappable background import in the drawing module so the scene, letterbox fill and surrounding backdrop always use the same artwork.
- Pre-render complete mirrored strips into synchronous canvas compositor layers on resize; translate them without per-frame scaling and keep letterbox fills static, avoiding asynchronous image decoding and unpainted strip gaps.
- Integrate the existing difficulty curve in one scroll module and share leftover-step interpolation and coverage calculations with tests, so cadence and quality rebuilds cannot alter world movement.
- Keep frame accumulation, resolution limits, adaptive quality and rolling measurements in the performance module; quality changes must never alter simulation tuning or world motion.