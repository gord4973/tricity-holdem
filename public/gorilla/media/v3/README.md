# Gorilla v3 media (built by /workspace/gorilla-notes/v3-media.sh from /workspace/gorilla-media/v3)
Clips: photoreal AI video, all starting/ending on the straight-on base pose (poster.jpg = front-base). H.264 High@4.0 720x1280 (-hd) and Main@3.1 480x854 (-sd), crf 26, faststart, no audio track.
idle-a/b/c (idle director, weighted, no repeats, random holds) · watch (spin start) · anticipate (feature tease) · lose · smallwin (fist slam ~2.26s) ·
chestbeat (beats 1.5–3.4s) · roar (peak ~1.3s) · slam (impact 1.28s). Clip list + cue times: CLIPS in /gorilla/video.js (drop a key to retire a clip).
Sound (WebAudio, synced to the clip clock): anticipate/lose/smallwin/chestbeat/slam.mp3 = the clips' own audio, EQ + room + loudness.
roar.mp3 = clip roar + "Gorillaschrei" by J0ck0 (freesound.org/s/397054, CC0); roar-real/grunt1/grunt2 = J0ck0 only.
br1–br6, huff1–3 = breath/huff one-shots cut from the idle/lose/anticipate clip audio, played by the randomized breathing engine (no loop).
sym/: photoreal symbols, background keyed to alpha, 256 (1x) + 512 (@2x) webp. Served with a 30-day immutable cache; bump ?v= in video.js/symbols.js when files change.

## v4 (MEDIA_V 5)
- punch-hd/sd + punch.mp3: one right-fist smash, impact frame 1.70 s. Used for the punch-nudge AND the lock smash (the old two-tap slam clip was removed).
- stare-hd/sd + stare.mp3: leans in and stares into the lens (random idle event every 45-90 s, and after some near misses).
- smallwin: trimmed to the single strike (impact 0.78 s). idle-c: calm tail only (ledge drumming removed).
- roar.mp3: CC0 roar (Freesound 397054, J0ck0) + pitched-down copy + sub layer + clip audio, saturated/compressed, peak -1.3 dBFS.
- chestbeat.mp3: clip audio + hollow chest thumps on each hand impact (1.50 1.75 1.96 2.25 2.48 2.75 3.00 3.19 3.38 s) + sub booms.
- br3-br6: re-cut from idle-b (the idle-c cuts contained thumps). Build scripts: gorilla-notes/v4-media.sh, v4-roar.sh.
