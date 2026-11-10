# BGM License and Provenance Documentation: Korobeiniki (8-Bit Chiptune)

This document records the provenance, public domain rationale by jurisdiction, and licensing terms for the background music (BGM) implemented in **Falling Blocks v1.2.0**.

---

## 1. Composition Provenance and Historical Background

The background music is based on the traditional Russian folk song **"Korobeiniki"** (Russian: *Коробейники*, also known as *Korobushka* / *Ой, полна, полна коробушка*).

1. **Original Poem:**
   - **Author:** Nikolay Alexeyevich Nekrasov (Николай Алексеевич Некрасов, 1821 – January 8, 1878 [O.S. December 27, 1877]).
   - **Publication:** Published in 1861 in the Russian literary magazine *Sovremennik* (*The Contemporary*).
2. **Traditional Musical Setting:**
   - In the late 19th century, the opening stanzas of Nekrasov's poem were adapted into a popular Russian folk dance and choral song.
   - The established melody was compiled, arranged, and published in traditional Russian songbooks, notably by Russian choirmaster and arranger **Yakov Fyodorovich Prigozhy** (Яков Фёдорович Пригожий, 1840 – 1920) in 1898.
   - The melody became firmly established in the oral folk tradition worldwide.

---

## 2. Public Domain Status by Jurisdiction

The underlying poem and traditional musical composition are strictly in the public domain in all major jurisdictions:

- **United States:**
  Under the United States Copyright Act (17 U.S.C. § 304(b) as amended by the Sonny Bono Copyright Term Extension Act), works published prior to January 1, 1929 have reached the expiration of their maximum statutory term (95 years from publication) and entered the public domain. Both Nekrasov's 1861 poem and Prigozhy's 1898 musical setting predate this threshold by decades and are firmly in the US public domain.
- **European Union and United Kingdom:**
  Under Directive 2006/116/EC (as amended) and the UK Copyright, Designs and Patents Act 1988, copyright expires 70 years after the death of the author (post-mortem auctoris / pma). Both author Nikolay Nekrasov (died 1878, >145 years pma) and 19th-century arranger Yakov Prigozhy (died 1920, >100 years pma) have been deceased for well over 70 years, confirming public domain status throughout the EU and UK.
- **Japan:**
  Under the Copyright Act of Japan (former Article 51, providing a 50-year term post mortem prior to the 2018 TPP11 70-year transition), copyright on works by authors deceased prior to 1968 expired under the 50-year rule without retroactive revival. Both Nekrasov and Prigozhy died prior to 1968, establishing public domain status under Japanese copyright law.

### Scope Restriction and Exclusion of Third-Party Works
This public domain rationale applies strictly and exclusively to the 1861 poem and the 1898 traditional folk melody. It does **not** apply to, nor does this project use or reference, any 20th or 21st-century commercial arrangements, recordings, or adaptations (such as Hirokazu Tanaka's 1989 Nintendo Game Boy arrangement or subsequent commercial game soundtracks).

---

## 3. Original Arrangement and Production Methodology

- **Arranger / Composer:** Antigravity (Pair-programming assistant for Falling Blocks project, 2026).
- **Instrumentation & Timbre (Authentic 8-Bit Chiptune Architecture):**
  - **Melody (Pulse 1):** 50% duty-cycle rectangular pulse wave with custom envelope and subtle vibrato.
  - **Counter-Melody (Pulse 2):** 25% duty-cycle pulse wave providing distinct harmonic counterpoint.
  - **Bass (Triangle):** Continuous triangle wave delivering a walking, pumping bassline.
  - **Percussion (Noise):** Procedural pseudo-random white noise and frequency-sweep synthesized kick, snare, and hi-hats.
  - **Arpeggios:** Rapid 16th-note arpeggiated triads adding retro shimmer.
- **Structure (48 Bars = 76.80 Seconds at 150 BPM, 4/4 Time):**
  - Intro: 4 bars (6.4s)
  - Main A: 16 bars (25.6s)
  - Main B: 16 bars (25.6s)
  - Return / Transition: 12 bars (19.2s)
  - *Seamless Loop:* 5 ms micro-cosine window at start and end ensures zero-crossing continuity and zero DC offset across loop boundaries on both stereo channels.
- **Production Pipeline:**
  - Standard MIDI File format 1 rendered via pure Python binary builder (`scripts/generate_bgm.py`).
  - 44.1 kHz 16-bit stereo PCM rendered programmatically without third-party soundfonts or copyrighted samples.
  - Encoded to OGG Vorbis (`-c:a libvorbis -q:a 5`) using `ffmpeg`.

---

## 4. Deliverables and Licensing

The following deliverable files are provided:
1. `public/audio/korobeiniki_8bit.ogg`: 44.1 kHz, 2-channel stereo, OGG Vorbis, 76.8s, seamless loop.
2. `assets/music-source/korobeiniki_8bit.mid`: Standard MIDI File Format 1 (5 synchronous tracks).
3. `scripts/generate_bgm.py`: Build-time reproducible synthesis script.

### License Grant
To the extent that any copyright or neighboring rights subsist in this original 8-bit arrangement, synthesized audio, or MIDI sequence, the author dedicates them to the public domain under the **Creative Commons CC0 1.0 Universal (Public Domain Dedication)** license, with a fallback **MIT License** for jurisdictions where public domain dedication is not recognized.
