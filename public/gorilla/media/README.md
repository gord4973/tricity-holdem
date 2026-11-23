# Gorilla media

Character layer (video.js): photoreal AI-generated clips, normalized to a 704x1296 canvas (HD, H.264 crf 28, lanczos + unsharp) and 448x824 (SD, used on Save-Data / 2g / 3g connections). All clips are muted; sound plays from the mp3s through WebAudio, kept in sync with the clip.
- idle-*.mp4: ping-pong breathing loop (~12 s). poster.jpg is frame 0.
- roar-*.mp4: roar (big win, bonus, jackpot). The lightning cue is at 1.2 s.
- chestbeat-*.mp4: chest beat (wins). Beats land at 2.42–3.95 s.
- slam-*.mp4: open-hand slam on the ledge (lock smash). Impacts at 1.12 s and 1.87 s.
Every action clip starts and ends on the base pose and crossfades back to idle.

Sound:
- roar.mp3: the roar clip's own audio, mixed with "Gorillaschrei" by J0ck0 (https://freesound.org/s/397054/, CC0), a real alpha gorilla roar recorded at a German zoo. Low-end EQ, reverb, loudnorm -13 LUFS.
- roar-real.mp3, grunt.mp3: the J0ck0 recording on its own (CC0).
- chestbeat.mp3, slam.mp3, idle.mp3: the clips' synced audio, processed the same way.

Optional hooks: list extra AI clips/stills in manifest.json, e.g. {"files":["big-win.mp4"]}.
