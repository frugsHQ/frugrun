# Architecture
- Keep gameplay in the existing canvas runner with fixed-step simulation and interpolated rendering; HUD updates are throttled to avoid per-frame React work.
- Keep playlist playback in a separate audio module so replay and menu transitions cannot recreate or restart the music.
- Use a fixed logical game height and orientation-specific view width with uniform scaling, so physics and sprite sizes are independent of display pixels.
- Normalize sprite frames and derive alpha-based geometry once at preload; share pose transforms and rendered swept collision shapes with debug guides so visible and physical anchors cannot diverge.
- Keep the swappable background import in the drawing module so the scene, letterbox fill and surrounding backdrop always use the same artwork.
- Pre-render painted layers and static letterbox fills on resize, then translate cropped image layers with the compositor; reserve the transparent gameplay canvas for moving sprites to avoid full-scene resampling.
- Keep frame accumulation, resolution limits, adaptive quality and rolling measurements in the performance module; quality changes must never alter simulation tuning or world motion.