# Spine 3.8 runtime

`spine38.js` comes from the animation package's `preview/vendor/spine-webgl.js`:
`D:/Study/Game/影斗_忍者竟技场/动作设计/骨骼动画_V1.0`.

Original runtime: Esoteric Software LLC, spine-ts 3.8, https://github.com/EsotericSoftware/spine-runtimes/tree/3.8 .
License and copyright notice are distributed in `public/assets/spine/SPINE-LICENSE.txt` and therefore in production builds.

The supplied runtime already contains a narrow 3.8.75 parsing exception for the generated
`shadow-duel-generated-v1` skeleton hash. This integration preserves that exception and
adds only a default ES module export, removing the unavailable source-map reference.
It does not change the declared skeleton version or modify original artwork projects.

The PixiJS 8 adapter currently renders RegionAttachment cutouts used by these two exports.
Unsupported attachment types cause an explicit loading error, rather than disappearing silently.
