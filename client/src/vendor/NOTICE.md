# Spine 3.8 runtime

`spine38.js` comes from the animation package's `preview/vendor/spine-webgl.js`:
`D:/Study/Game/影斗_忍者竟技场/动作设计/骨骼动画_V1.0`.

Original runtime: Esoteric Software LLC, spine-ts 3.8, https://github.com/EsotericSoftware/spine-runtimes/tree/3.8 .
License and copyright notice are distributed in `public/assets/spine/SPINE-LICENSE.txt` and therefore in production builds.

The supplied runtime already contains a narrow JSON 3.8.75 parsing exception for the generated
`shadow-duel-generated-v1` skeleton hash. This integration adds the three tested formal JSON exports:
`y9GIuQgeCgwUu5f5lKkPCFnB9NM` (Hayate), `+co3anCn2w6d8JjvEX0+d/P024I` (Iwaya),
and `Cw2AuzaRksqt183MP99NYh082sU` (independent effects). All 100 exported animations are evaluated
in local tests. Unknown hashes retain the version rejection. The binary reader's original
3.8.75 rejection is restored; binary SKEL compatibility is not claimed.

The ES module export/source-map changes are retained. No skeleton version is falsified.
The manual importer restores authored RegionAttachment dimensions and unmodified RGBA source pixels,
correcting the supplied export's size reset and atlas-wide RGB dilation. Original editable art
projects and gameplay timelines are not modified.

The PixiJS 8 adapter currently renders RegionAttachment cutouts used by these three exports.
Unsupported attachment types cause an explicit loading error, rather than disappearing silently.
