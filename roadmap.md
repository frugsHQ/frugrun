# Current regression fixes
- [x] Decode/retry assets, synchronous scene layers, visibility/size/DPR rebuilds and fallback; preview verified
- [x] Mirrored full-width coverage and D coverage diagnostics, including physical tile side margins
- [x] Cadence/interpolation tests and 10-second speed deviation; 25 focused tests pass
- [x] Landscape card/HUD verification at 844×390, 932×430, 667×375 and 1024×768
- [ ] Verify fixes in production: waiting for permission to publish; old production visit did not reproduce persistent black scene
- [ ] Consistent desktop 60 FPS: measured 22.7ms average / 33.4ms p95; rendering/overall frame performance remains below target

# Gameplay polish
- [x] Measure desktop/mobile frame costs and identify stutter sources
- [x] Real-time accumulator, world-derived entity positions and simulation-driven gameplay timers
- [x] Reduce rendering/collision costs, cap resolution and adapt quality; residual geometry allocations and transparent full-frame sprite canvas remain
- [x] Upgrade D diagnostics and clipboard report
- [x] Run focused tests and desktop/mobile gameplay checks; tall desktop compositor remains below 60 FPS in sandbox
- [x] Fixed-step simulation, logical camera, image preload and cached rendering
- [x] Variable jump, buffered input, grounded animation and pooled effects
- [x] Desktop frame, mobile HUD, fullscreen, keyboard-safe menus and pause countdown
- [x] Persistent playlist player, Frugs Life song and independent effects volume
- [x] Tests and desktop/portrait/landscape checks
- [x] Background-filled letterboxing and secondary menu button
- [x] Normalize Frug frames and add anchor debug guides
- [x] Add subtle regional hat/cape sway; bitmap layer overlap remains a visual limitation
- [x] Retune jump airtime and apex hang; safe obstacle recovery spacing
- [x] Alpha-derived silhouette shapes, rendered translation sweeps, coin radius and single-hit protection
- [x] Compare statue edit and retain original: generated edit failed close-match requirement
- [x] Focused tests and desktop/portrait/landscape gameplay checks
