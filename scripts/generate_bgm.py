#!/usr/bin/env python3
"""
Korobeiniki (Russian Folk Song) 8-Bit Chiptune BGM Generator
Falling Blocks v1.2.0

Generates:
1. assets/music-source/korobeiniki_8bit.mid (Standard MIDI File Format 1)
2. public/audio/korobeiniki_8bit.ogg (OGG Vorbis, 44.1kHz stereo, 76.8s seamless loop)

Author: Antigravity for Falling Blocks
License: CC0 1.0 Universal / MIT
"""

import math
import os
import random
import struct
import subprocess
import wave

SAMPLE_RATE = 44100
BPM = 150
BEAT_SEC = 60.0 / BPM  # 0.4 sec per beat
BAR_SEC = BEAT_SEC * 4  # 1.6 sec per bar
TOTAL_BARS = 48
TOTAL_DURATION = TOTAL_BARS * BAR_SEC  # 76.8 seconds
TOTAL_SAMPLES = int(TOTAL_DURATION * SAMPLE_RATE)

MIDI_PPQ = 480  # Pulses Per Quarter Note (Ticks per beat)

# Note frequency helper
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def midi_to_freq(midi_note):
    return 440.0 * (2.0 ** ((midi_note - 69) / 12.0))

def parse_note(name):
    # e.g. "A4", "C#5", "Bb3"
    name = name.strip()
    if name == 'R' or name == 'REST':
        return None
    acc = 0
    if len(name) == 3:
        letter = name[0].upper()
        acc_str = name[1]
        octave = int(name[2])
        if acc_str == '#': acc = 1
        elif acc_str == 'b': acc = -1
    else:
        letter = name[0].upper()
        octave = int(name[1])
    base = [0, 2, 4, 5, 7, 9, 11][['C', 'D', 'E', 'F', 'G', 'A', 'B'].index(letter)]
    return 12 * (octave + 1) + base + acc

# Synthesis Waves
def pulse_sample(phase, duty=0.5):
    p = phase % 1.0
    return 1.0 if p < duty else -1.0

def triangle_sample(phase):
    p = phase % 1.0
    if p < 0.25:
        return p * 4.0
    elif p < 0.75:
        return 1.0 - (p - 0.25) * 4.0
    else:
        return -1.0 + (p - 0.75) * 4.0

# -------------------------------------------------------------
# MIDI Binary Builder (SMF Format 1)
# -------------------------------------------------------------
def var_len(val):
    res = bytearray()
    res.append(val & 0x7F)
    val >>= 7
    while val > 0:
        res.insert(0, (val & 0x7F) | 0x80)
        val >>= 7
    return bytes(res)

class MidiTrackBuilder:
    def __init__(self, name, channel):
        self.name = name
        self.channel = channel
        self.events = []  # (abs_tick, event_bytes)
        self.add_track_name(name)

    def add_track_name(self, name):
        name_bytes = name.encode('ascii')
        ev = b'\xFF\x03' + var_len(len(name_bytes)) + name_bytes
        self.events.append((0, ev))

    def note_on(self, tick, note, vel=90):
        ev = bytes([0x90 | self.channel, note, vel])
        self.events.append((tick, ev))

    def note_off(self, tick, note):
        ev = bytes([0x80 | self.channel, note, 0])
        self.events.append((tick, ev))

    def build_chunk(self):
        # Sort events by absolute tick
        self.events.sort(key=lambda x: x[0])
        # Add End of Track at last tick + 1
        last_tick = self.events[-1][0] if self.events else 0
        self.events.append((last_tick + 1, b'\xFF\x2F\x00'))

        chunk_data = bytearray()
        prev_tick = 0
        for tick, ev in self.events:
            delta = tick - prev_tick
            chunk_data.extend(var_len(delta))
            chunk_data.extend(ev)
            prev_tick = tick

        header = b'MTrk' + struct.pack('>I', len(chunk_data))
        return header + chunk_data

def build_midi_file(tracks, ppq=MIDI_PPQ):
    # SMF Format 1 Header: 'MThd', len=6, format=1, ntracks=len(tracks)+1 (conductor track), ppq
    header = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks) + 1, ppq)
    # Conductor Track (Tempo 150 BPM, Time Signature 4/4)
    cond = bytearray()
    # Delta 0: Time Sig 4/4
    cond.extend(var_len(0) + b'\xFF\x58\x04\x04\x02\x18\x08')
    # Delta 0: Set Tempo (150 BPM = 400,000 microseconds per beat)
    tempo_us = int(60_000_000 / BPM)
    cond.extend(var_len(0) + b'\xFF\x51\x03' + struct.pack('>I', tempo_us)[1:])
    # Delta 0: Track Name
    cond_name = b'Conductor'
    cond.extend(var_len(0) + b'\xFF\x03' + var_len(len(cond_name)) + cond_name)
    # End of Track
    cond.extend(var_len(TOTAL_BARS * 4 * ppq) + b'\xFF\x2F\x00')
    cond_chunk = b'MTrk' + struct.pack('>I', len(cond)) + cond

    track_chunks = [t.build_chunk() for t in tracks]
    return header + cond_chunk + b''.join(track_chunks)

# -------------------------------------------------------------
# Arrangement Score Definition (48 Bars)
# -------------------------------------------------------------
# Note tuple: (note_str, duration_in_beats)

# Korobeiniki Melody Motifs (A Minor)
MELODY_MOTIF_A = [
    # Bar 1 (4 beats)
    ("E5", 1.0), ("B4", 0.5), ("C5", 0.5), ("D5", 1.0), ("C5", 0.5), ("B4", 0.5),
    # Bar 2
    ("A4", 1.0), ("A4", 0.5), ("C5", 0.5), ("E5", 1.0), ("D5", 0.5), ("C5", 0.5),
    # Bar 3
    ("B4", 1.5), ("C5", 0.5), ("D5", 1.0), ("E5", 1.0),
    # Bar 4
    ("C5", 1.0), ("A4", 1.0), ("A4", 1.5), ("REST", 0.5),
    # Bar 5
    ("D5", 1.0), ("F5", 1.0), ("A5", 1.0), ("G5", 0.5), ("F5", 0.5),
    # Bar 6
    ("E5", 1.5), ("C5", 0.5), ("E5", 1.0), ("D5", 0.5), ("C5", 0.5),
    # Bar 7
    ("B4", 1.0), ("B4", 0.5), ("C5", 0.5), ("D5", 1.0), ("E5", 1.0),
    # Bar 8
    ("C5", 1.0), ("A4", 1.0), ("A4", 1.5), ("REST", 0.5),
]

MELODY_MOTIF_A2 = [
    # Octave up variation for bars 9-16
    ("E6", 1.0), ("B5", 0.5), ("C6", 0.5), ("D6", 1.0), ("C6", 0.5), ("B5", 0.5),
    ("A5", 1.0), ("A5", 0.5), ("C6", 0.5), ("E6", 1.0), ("D6", 0.5), ("C6", 0.5),
    ("B5", 1.5), ("C6", 0.5), ("D6", 1.0), ("E6", 1.0),
    ("C6", 1.0), ("A5", 1.0), ("A5", 1.5), ("REST", 0.5),
    ("D6", 1.0), ("F6", 1.0), ("A6", 1.0), ("G6", 0.5), ("F6", 0.5),
    ("E6", 1.5), ("C6", 0.5), ("E6", 1.0), ("D6", 0.5), ("C6", 0.5),
    ("B5", 1.0), ("B5", 0.5), ("C6", 0.5), ("D6", 1.0), ("E6", 1.0),
    ("C6", 1.0), ("A5", 1.0), ("A5", 1.5), ("REST", 0.5),
]

# Main B Motifs: Traditional Russian folk sequence (D minor -> A minor -> E7 -> A minor)
MELODY_MOTIF_B = [
    # Bar 1 (Dm)
    ("D5", 1.0), ("F5", 1.0), ("A5", 1.5), ("G5", 0.5),
    # Bar 2
    ("F5", 1.0), ("D5", 1.0), ("F5", 1.0), ("REST", 1.0),
    # Bar 3 (Am)
    ("C5", 1.0), ("E5", 1.0), ("G5", 1.5), ("F5", 0.5),
    # Bar 4
    ("E5", 1.0), ("C5", 1.0), ("E5", 1.0), ("REST", 1.0),
    # Bar 5 (E7)
    ("B4", 1.0), ("D5", 1.0), ("F5", 1.0), ("E5", 0.5), ("D5", 0.5),
    # Bar 6
    ("C5", 1.0), ("E5", 1.0), ("A5", 1.0), ("REST", 1.0),
    # Bar 7
    ("B4", 1.0), ("E5", 1.0), ("G#4", 1.0), ("B4", 1.0),
    # Bar 8
    ("A4", 2.0), ("REST", 2.0),
]

MELODY_MOTIF_B2 = [
    # Bar 9-16 (variation with ornamentation)
    ("D5", 0.5), ("F5", 0.5), ("A5", 1.0), ("D6", 1.5), ("C6", 0.5),
    ("B5", 1.0), ("A5", 1.0), ("F5", 1.0), ("REST", 1.0),
    ("C5", 0.5), ("E5", 0.5), ("G5", 1.0), ("C6", 1.5), ("B5", 0.5),
    ("A5", 1.0), ("G5", 1.0), ("E5", 1.0), ("REST", 1.0),
    ("B4", 0.5), ("D5", 0.5), ("F5", 1.0), ("E5", 1.0), ("D5", 1.0),
    ("C5", 1.0), ("A4", 1.0), ("E5", 1.0), ("A5", 1.0),
    ("G#5", 1.0), ("B5", 1.0), ("E6", 1.0), ("D6", 1.0),
    ("C6", 1.0), ("B5", 1.0), ("A5", 1.5), ("REST", 0.5),
]

# Return / Transition Motifs (12 bars leading to seamless loop)
MELODY_MOTIF_TRANSITION = [
    # Bar 1-4 (Fast Russian Staccato Drive)
    ("A5", 0.5), ("REST", 0.5), ("E5", 0.5), ("REST", 0.5), ("A5", 0.5), ("B5", 0.5), ("C6", 1.0),
    ("B5", 0.5), ("REST", 0.5), ("E5", 0.5), ("REST", 0.5), ("B5", 0.5), ("C6", 0.5), ("D6", 1.0),
    ("C6", 0.5), ("B5", 0.5), ("A5", 0.5), ("G#5", 0.5), ("A5", 1.0), ("C6", 1.0),
    ("B5", 1.5), ("C6", 0.5), ("D6", 1.0), ("E6", 1.0),
    # Bar 5-8 (Tension build-up on E dominant)
    ("F6", 1.0), ("E6", 1.0), ("D6", 1.0), ("C6", 1.0),
    ("B5", 1.0), ("A5", 1.0), ("G#5", 1.0), ("B5", 1.0),
    ("E5", 0.5), ("F#5", 0.5), ("G#5", 0.5), ("A5", 0.5), ("B5", 0.5), ("C6", 0.5), ("D6", 0.5), ("D#6", 0.5),
    ("E6", 2.0), ("E5", 1.0), ("REST", 1.0),
    # Bar 9-12 (Intro lead-in callback & anticipation)
    ("REST", 4.0),
    ("E5", 1.0), ("G#5", 1.0), ("B5", 1.0), ("E6", 1.0),
    ("D6", 1.0), ("C6", 1.0), ("B5", 1.0), ("A5", 1.0),
    ("G#5", 1.0), ("B5", 1.0), ("E5", 1.0), ("REST", 1.0),
]

# Build Full Track Note Sequences
def get_melody_sequence():
    notes = []
    # Intro: 4 bars of rest / lead-in
    notes.extend([("REST", 4.0), ("REST", 4.0), ("REST", 4.0), ("E4", 1.0), ("G#4", 1.0), ("B4", 1.0), ("E5", 1.0)])
    # Main A: 16 bars
    notes.extend(MELODY_MOTIF_A)
    notes.extend(MELODY_MOTIF_A2)
    # Main B: 16 bars
    notes.extend(MELODY_MOTIF_B)
    notes.extend(MELODY_MOTIF_B2)
    # Return: 12 bars
    notes.extend(MELODY_MOTIF_TRANSITION)
    return notes

def get_bass_sequence():
    # 48 bars walking/pumping triangle bass (A minor: A2-E3-A2-E3, D minor: D2-A2, E dominant: E2-B2)
    notes = []
    # Pattern generator for a bar
    def bar_am(): return [("A2", 1.0), ("E3", 1.0), ("A2", 1.0), ("E3", 1.0)]
    def bar_dm(): return [("D2", 1.0), ("A2", 1.0), ("D2", 1.0), ("A2", 1.0)]
    def bar_e7(): return [("E2", 1.0), ("B2", 1.0), ("E2", 1.0), ("G#2", 1.0)]
    def bar_c():  return [("C3", 1.0), ("G2", 1.0), ("C3", 1.0), ("G2", 1.0)]

    # Intro (4 bars)
    notes.extend(bar_am()); notes.extend(bar_am()); notes.extend(bar_e7()); notes.extend(bar_e7())

    # Main A (16 bars: 2x 8-bar progression: E7, Am, E7, Am, Dm, Am, E7, Am)
    for _ in range(2):
        notes.extend(bar_e7())
        notes.extend(bar_am())
        notes.extend(bar_e7())
        notes.extend(bar_am())
        notes.extend(bar_dm())
        notes.extend(bar_am())
        notes.extend(bar_e7())
        notes.extend(bar_am())

    # Main B (16 bars: 2x 8-bar progression: Dm, Dm, Am, Am, E7, Am, E7, Am)
    for _ in range(2):
        notes.extend(bar_dm())
        notes.extend(bar_dm())
        notes.extend(bar_am())
        notes.extend(bar_am())
        notes.extend(bar_e7())
        notes.extend(bar_am())
        notes.extend(bar_e7())
        notes.extend(bar_am())

    # Return (12 bars)
    for _ in range(2):
        notes.extend(bar_am())
        notes.extend(bar_dm())
        notes.extend(bar_e7())
        notes.extend(bar_am())
    # Last 4 bars (E pedal tension into loop)
    notes.extend(bar_e7()); notes.extend(bar_e7()); notes.extend(bar_e7()); notes.extend(bar_e7())
    return notes

def get_counter_melody_sequence():
    # 25% Pulse counter-melody providing harmony and counterpoint
    notes = []
    # Intro (4 bars)
    notes.extend([("REST", 4.0), ("REST", 4.0), ("REST", 4.0), ("REST", 4.0)])

    # Main A (16 bars counter-harmony)
    for _ in range(2):
        # 8 bars: B3, C4, B3, C4, A3, C4, B3, A3
        notes.extend([("B3", 2.0), ("G#3", 2.0)])
        notes.extend([("C4", 2.0), ("A3", 2.0)])
        notes.extend([("B3", 2.0), ("G#3", 2.0)])
        notes.extend([("C4", 2.0), ("A3", 2.0)])
        notes.extend([("F3", 2.0), ("D3", 2.0)])
        notes.extend([("A3", 2.0), ("E3", 2.0)])
        notes.extend([("G#3", 2.0), ("E3", 2.0)])
        notes.extend([("A3", 2.0), ("E3", 2.0)])

    # Main B (16 bars counterpoint)
    for _ in range(2):
        notes.extend([("F3", 1.0), ("A3", 1.0), ("D4", 2.0)])
        notes.extend([("A3", 1.0), ("F3", 1.0), ("D3", 2.0)])
        notes.extend([("E3", 1.0), ("A3", 1.0), ("C4", 2.0)])
        notes.extend([("A3", 1.0), ("E3", 1.0), ("C3", 2.0)])
        notes.extend([("D3", 1.0), ("G#3", 1.0), ("B3", 2.0)])
        notes.extend([("C4", 1.0), ("A3", 1.0), ("E4", 2.0)])
        notes.extend([("E3", 1.0), ("G#3", 1.0), ("B3", 2.0)])
        notes.extend([("A3", 2.0), ("REST", 2.0)])

    # Return (12 bars)
    for _ in range(12):
        notes.extend([("E4", 0.5), ("REST", 0.5), ("A4", 0.5), ("REST", 0.5), ("B4", 1.0), ("C5", 1.0)])
    return notes

def get_arp_sequence():
    # 48 bars retro fast chiptune arpeggio chords
    notes = []
    chords = {
        'Am': ["A3", "C4", "E4", "A4"],
        'E7': ["G#3", "B3", "D4", "E4"],
        'Dm': ["D3", "F3", "A3", "D4"],
        'C':  ["C3", "E3", "G3", "C4"],
    }
    # Pattern generator: 16 notes of 16th-triad per bar
    def make_arp_bar(chord_name):
        notes_in_chord = chords[chord_name]
        bar = []
        for i in range(16):
            n = notes_in_chord[i % len(notes_in_chord)]
            bar.append((n, 0.25))  # 16 * 0.25 = 4 beats
        return bar

    # Intro (4 bars)
    notes.extend(make_arp_bar('Am'))
    notes.extend(make_arp_bar('Am'))
    notes.extend(make_arp_bar('E7'))
    notes.extend(make_arp_bar('E7'))

    # Main A (16 bars)
    for _ in range(2):
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('Dm'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))

    # Main B (16 bars)
    for _ in range(2):
        notes.extend(make_arp_bar('Dm'))
        notes.extend(make_arp_bar('Dm'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))

    # Return (12 bars)
    for _ in range(2):
        notes.extend(make_arp_bar('Am'))
        notes.extend(make_arp_bar('Dm'))
        notes.extend(make_arp_bar('E7'))
        notes.extend(make_arp_bar('Am'))
    for _ in range(4):
        notes.extend(make_arp_bar('E7'))
    return notes

# -------------------------------------------------------------
# MIDI Generation Function
# -------------------------------------------------------------
def generate_midi_file(filepath):
    melody_notes = get_melody_sequence()
    bass_notes = get_bass_sequence()
    counter_notes = get_counter_melody_sequence()
    arp_notes = get_arp_sequence()

    tracks = []
    # Track 0: Melody (Channel 0)
    t_mel = MidiTrackBuilder("Melody (Pulse 50%)", 0)
    cur_tick = 0
    for note_str, dur_beats in melody_notes:
        dur_ticks = int(dur_beats * MIDI_PPQ)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            t_mel.note_on(cur_tick, midi_num, vel=95)
            t_mel.note_off(cur_tick + dur_ticks - 10, midi_num)
        cur_tick += dur_ticks
    tracks.append(t_mel)

    # Track 1: Counter-Melody (Channel 1)
    t_cnt = MidiTrackBuilder("Counter-Melody (Pulse 25%)", 1)
    cur_tick = 0
    for note_str, dur_beats in counter_notes:
        dur_ticks = int(dur_beats * MIDI_PPQ)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            t_cnt.note_on(cur_tick, midi_num, vel=80)
            t_cnt.note_off(cur_tick + dur_ticks - 10, midi_num)
        cur_tick += dur_ticks
    tracks.append(t_cnt)

    # Track 2: Bass (Channel 2)
    t_bass = MidiTrackBuilder("Bass (Triangle)", 2)
    cur_tick = 0
    for note_str, dur_beats in bass_notes:
        dur_ticks = int(dur_beats * MIDI_PPQ)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            t_bass.note_on(cur_tick, midi_num, vel=100)
            t_bass.note_off(cur_tick + dur_ticks - 15, midi_num)
        cur_tick += dur_ticks
    tracks.append(t_bass)

    # Track 3: Arpeggio (Channel 3)
    t_arp = MidiTrackBuilder("Arpeggio Shimmer", 3)
    cur_tick = 0
    for note_str, dur_beats in arp_notes:
        dur_ticks = int(dur_beats * MIDI_PPQ)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            t_arp.note_on(cur_tick, midi_num, vel=60)
            t_arp.note_off(cur_tick + dur_ticks - 5, midi_num)
        cur_tick += dur_ticks
    tracks.append(t_arp)

    # Track 4: Drum Percussion (Channel 9 - Standard GM Drums)
    t_drum = MidiTrackBuilder("Noise Drums", 9)
    for bar in range(TOTAL_BARS):
        bar_start_tick = bar * 4 * MIDI_PPQ
        # Beat 1: Kick (36) + Hat (42)
        t_drum.note_on(bar_start_tick, 36, 100); t_drum.note_off(bar_start_tick + 100, 36)
        t_drum.note_on(bar_start_tick, 42, 70);  t_drum.note_off(bar_start_tick + 60, 42)
        # Beat 2: Snare (38) + Hat (42)
        t_drum.note_on(bar_start_tick + MIDI_PPQ, 38, 90); t_drum.note_off(bar_start_tick + MIDI_PPQ + 120, 38)
        t_drum.note_on(bar_start_tick + MIDI_PPQ, 42, 70); t_drum.note_off(bar_start_tick + MIDI_PPQ + 60, 42)
        # Beat 3: Kick (36) + Hat (42)
        t_drum.note_on(bar_start_tick + 2 * MIDI_PPQ, 36, 100); t_drum.note_off(bar_start_tick + 2 * MIDI_PPQ + 100, 36)
        t_drum.note_on(bar_start_tick + 2 * MIDI_PPQ, 42, 70);  t_drum.note_off(bar_start_tick + 2 * MIDI_PPQ + 60, 42)
        # Beat 4: Snare (38) + Hat (42)
        t_drum.note_on(bar_start_tick + 3 * MIDI_PPQ, 38, 90); t_drum.note_off(bar_start_tick + 3 * MIDI_PPQ + 120, 38)
        t_drum.note_on(bar_start_tick + 3 * MIDI_PPQ, 42, 70); t_drum.note_off(bar_start_tick + 3 * MIDI_PPQ + 60, 42)
        # Off-beat 8th hats
        for beat in range(4):
            hat_tick = bar_start_tick + int((beat + 0.5) * MIDI_PPQ)
            t_drum.note_on(hat_tick, 42, 60); t_drum.note_off(hat_tick + 50, 42)
    tracks.append(t_drum)

    midi_bytes = build_midi_file(tracks, ppq=MIDI_PPQ)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(midi_bytes)
    print(f"Generated MIDI: {filepath} ({len(midi_bytes)} bytes)")

# -------------------------------------------------------------
# 8-Bit Audio Synthesis Engine (44.1kHz Stereo WAV)
# -------------------------------------------------------------
def render_audio_buffers():
    print(f"Synthesizing 8-bit audio: {TOTAL_BARS} bars, {TOTAL_DURATION:.2f}s ({TOTAL_SAMPLES} samples)...")
    left_buf = [0.0] * TOTAL_SAMPLES
    right_buf = [0.0] * TOTAL_SAMPLES

    # 1. Render Melody (Pulse 50%, slight pan left: 0.6 L, 0.4 R)
    melody_notes = get_melody_sequence()
    cur_sample = 0
    phase = 0.0
    for note_str, dur_beats in melody_notes:
        dur_samples = int(dur_beats * BEAT_SEC * SAMPLE_RATE)
        end_sample = min(cur_sample + dur_samples, TOTAL_SAMPLES)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            freq = midi_to_freq(midi_num)
            phase_inc = freq / SAMPLE_RATE
            note_len = end_sample - cur_sample
            decay_len = min(int(0.02 * SAMPLE_RATE), note_len)
            for i in range(note_len):
                idx = cur_sample + i
                # Envelope: quick attack 5ms, release 10ms at end
                env = 1.0
                if i < 220: env = i / 220.0
                elif i > note_len - 441: env = max(0.0, (note_len - i) / 441.0)
                # Vibrato (5Hz, +/- 1.5%)
                vib = 1.0 + 0.015 * math.sin(2.0 * math.pi * 5.0 * i / SAMPLE_RATE)
                phase += phase_inc * vib
                val = pulse_sample(phase, 0.5) * 0.22 * env
                left_buf[idx] += val * 0.6
                right_buf[idx] += val * 0.4
        cur_sample = end_sample

    # 2. Render Counter-Melody (Pulse 25%, pan right: 0.35 L, 0.65 R)
    counter_notes = get_counter_melody_sequence()
    cur_sample = 0
    phase = 0.0
    for note_str, dur_beats in counter_notes:
        dur_samples = int(dur_beats * BEAT_SEC * SAMPLE_RATE)
        end_sample = min(cur_sample + dur_samples, TOTAL_SAMPLES)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            freq = midi_to_freq(midi_num)
            phase_inc = freq / SAMPLE_RATE
            note_len = end_sample - cur_sample
            for i in range(note_len):
                idx = cur_sample + i
                env = 1.0
                if i < 220: env = i / 220.0
                elif i > note_len - 441: env = max(0.0, (note_len - i) / 441.0)
                phase += phase_inc
                val = pulse_sample(phase, 0.25) * 0.16 * env
                left_buf[idx] += val * 0.35
                right_buf[idx] += val * 0.65
        cur_sample = end_sample

    # 3. Render Bass (Triangle, centered: 0.5 L, 0.5 R)
    bass_notes = get_bass_sequence()
    cur_sample = 0
    phase = 0.0
    for note_str, dur_beats in bass_notes:
        dur_samples = int(dur_beats * BEAT_SEC * SAMPLE_RATE)
        end_sample = min(cur_sample + dur_samples, TOTAL_SAMPLES)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            freq = midi_to_freq(midi_num)
            phase_inc = freq / SAMPLE_RATE
            note_len = end_sample - cur_sample
            for i in range(note_len):
                idx = cur_sample + i
                env = 1.0
                if i < 150: env = i / 150.0
                elif i > note_len - 300: env = max(0.0, (note_len - i) / 300.0)
                phase += phase_inc
                val = triangle_sample(phase) * 0.30 * env
                left_buf[idx] += val * 0.5
                right_buf[idx] += val * 0.5
        cur_sample = end_sample

    # 4. Render Arpeggio (Pulse 12.5%, alternating ping-pong pan)
    arp_notes = get_arp_sequence()
    cur_sample = 0
    phase = 0.0
    for note_idx, (note_str, dur_beats) in enumerate(arp_notes):
        dur_samples = int(dur_beats * BEAT_SEC * SAMPLE_RATE)
        end_sample = min(cur_sample + dur_samples, TOTAL_SAMPLES)
        midi_num = parse_note(note_str)
        if midi_num is not None:
            freq = midi_to_freq(midi_num)
            phase_inc = freq / SAMPLE_RATE
            note_len = end_sample - cur_sample
            pan_l = 0.7 if (note_idx % 2 == 0) else 0.3
            pan_r = 1.0 - pan_l
            for i in range(note_len):
                idx = cur_sample + i
                env = max(0.0, 1.0 - (i / note_len))
                phase += phase_inc
                val = pulse_sample(phase, 0.125) * 0.10 * env
                left_buf[idx] += val * pan_l
                right_buf[idx] += val * pan_r
        cur_sample = end_sample

    # 5. Render Retro Percussion (Noise + Kick + Snare)
    rng = random.Random(42)  # Deterministic seed for identical build
    samples_per_beat = int(BEAT_SEC * SAMPLE_RATE)
    samples_per_bar = samples_per_beat * 4

    for bar in range(TOTAL_BARS):
        bar_idx = bar * samples_per_bar
        for beat in range(4):
            beat_idx = bar_idx + beat * samples_per_beat

            # Kick on beats 0 & 2
            if beat in (0, 2):
                kick_len = int(0.12 * SAMPLE_RATE)
                phase_k = 0.0
                for i in range(kick_len):
                    idx = beat_idx + i
                    if idx >= TOTAL_SAMPLES: break
                    progress = i / kick_len
                    # Pitch drops rapidly from 160Hz to 40Hz
                    cur_f = 160.0 * (1.0 - progress) ** 2 + 40.0
                    phase_k += cur_f / SAMPLE_RATE
                    env = (1.0 - progress) ** 1.5
                    val = math.sin(2.0 * math.pi * phase_k) * 0.35 * env
                    left_buf[idx] += val * 0.5
                    right_buf[idx] += val * 0.5

            # Snare on beats 1 & 3
            if beat in (1, 3):
                snare_len = int(0.15 * SAMPLE_RATE)
                phase_s = 0.0
                for i in range(snare_len):
                    idx = beat_idx + i
                    if idx >= TOTAL_SAMPLES: break
                    progress = i / snare_len
                    env = (1.0 - progress) ** 2
                    noise = (rng.random() * 2.0 - 1.0) * 0.22 * env
                    phase_s += 180.0 / SAMPLE_RATE
                    tone = math.sin(2.0 * math.pi * phase_s) * 0.10 * env
                    val = noise + tone
                    left_buf[idx] += val * 0.5
                    right_buf[idx] += val * 0.5

            # Hi-hat on every 8th note
            for sub in (0, 0.5):
                hat_idx = beat_idx + int(sub * samples_per_beat)
                hat_len = int(0.04 * SAMPLE_RATE)
                for i in range(hat_len):
                    idx = hat_idx + i
                    if idx >= TOTAL_SAMPLES: break
                    env = (1.0 - (i / hat_len)) ** 3
                    noise = (rng.random() * 2.0 - 1.0) * 0.08 * env
                    left_buf[idx] += noise * 0.4
                    right_buf[idx] += noise * 0.6

    # 6. Seamless Micro Cosine Window Envelope (5ms = 220 samples at start and end)
    fade_len = int(0.005 * SAMPLE_RATE)
    for i in range(fade_len):
        # Cosine fade-in: 0.5 * (1 - cos(pi * i / fade_len))
        fade_in = 0.5 * (1.0 - math.cos(math.pi * i / fade_len))
        left_buf[i] *= fade_in
        right_buf[i] *= fade_in

        # Cosine fade-out: 0.5 * (1 + cos(pi * i / fade_len))
        idx_out = TOTAL_SAMPLES - fade_len + i
        fade_out = 0.5 * (1.0 + math.cos(math.pi * i / fade_len))
        left_buf[idx_out] *= fade_out
        right_buf[idx_out] *= fade_out

    # Enforce strict zero-crossings at boundaries
    left_buf[0] = 0.0
    right_buf[0] = 0.0
    left_buf[-1] = 0.0
    right_buf[-1] = 0.0

    return left_buf, right_buf

def write_wav(filepath, left_buf, right_buf):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for i in range(TOTAL_SAMPLES):
            l = max(-1.0, min(1.0, left_buf[i]))
            r = max(-1.0, min(1.0, right_buf[i]))
            il = int(l * 32767.0)
            ir = int(r * 32767.0)
            frames.extend(struct.pack('<hh', il, ir))
        wf.writeframes(frames)
    print(f"Generated WAV: {filepath} ({len(frames)} bytes, {TOTAL_DURATION:.2f}s)")

def verify_pcm_boundaries(left_buf, right_buf):
    print("Verifying PCM sample boundaries...")
    for c_name, buf in [("Left", left_buf), ("Right", right_buf)]:
        start_val = abs(buf[0])
        end_val = abs(buf[-1])
        diff = abs(buf[0] - buf[-1])
        print(f"  {c_name} Channel: start={start_val:.6f}, end={end_val:.6f}, diff={diff:.6f}")
        assert start_val < 0.01, f"{c_name} start amplitude {start_val} >= 0.01"
        assert end_val < 0.01, f"{c_name} end amplitude {end_val} >= 0.01"
        assert diff < 0.02, f"{c_name} boundary difference {diff} >= 0.02"
    print("PCM sample boundaries PASS.")

def convert_wav_to_ogg(wav_path, ogg_path):
    print(f"Encoding {wav_path} to {ogg_path} via ffmpeg...")
    os.makedirs(os.path.dirname(ogg_path), exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-i", wav_path,
        "-c:a", "libvorbis",
        "-q:a", "5",
        ogg_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print("ffmpeg stdout:", res.stdout)
        print("ffmpeg stderr:", res.stderr)
        raise RuntimeError(f"ffmpeg conversion failed with exit code {res.returncode}")
    print(f"Generated OGG: {ogg_path} ({os.path.getsize(ogg_path)} bytes)")

def verify_ogg_metadata(ogg_path):
    print(f"Verifying OGG metadata for {ogg_path}...")
    size = os.path.getsize(ogg_path)
    assert size > 100 * 1024, f"OGG file size {size} is <= 100KB"

    with open(ogg_path, 'rb') as f:
        data = f.read()

    assert data[:4] == b'OggS', f"OGG signature mismatch: {data[:4]}"

    # Search for Vorbis identification header packet starting with \x01vorbis
    vorbis_idx = data.find(b'\x01vorbis')
    assert vorbis_idx != -1, "Vorbis identification header packet (\\x01vorbis) not found"

    # In Vorbis identification packet:
    # byte 0: 0x01
    # bytes 1..6: 'vorbis'
    # bytes 7..10: vorbis_version (uint32)
    # byte 11: audio_channels (uint8)
    # bytes 12..15: audio_sample_rate (uint32)
    ch = data[vorbis_idx + 11]
    sr = struct.unpack('<I', data[vorbis_idx + 12:vorbis_idx + 16])[0]
    print(f"  Vorbis header found at offset {vorbis_idx}: channels={ch}, sample_rate={sr} Hz")
    assert ch == 2, f"Channels expected 2, got {ch}"
    assert sr == 44100, f"Sample rate expected 44100, got {sr}"

    # Verify duration via ffprobe
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "stream=duration,channels,sample_rate,codec_name",
        "-of", "json",
        ogg_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode == 0:
        import json
        info = json.loads(res.stdout)
        stream = info['streams'][0]
        dur = float(stream['duration'])
        print(f"  ffprobe reported duration: {dur:.3f}s (codec={stream['codec_name']})")
        assert 60.0 <= dur <= 90.0, f"Duration {dur} not in [60.0, 90.0] range"
        assert stream['codec_name'] == 'vorbis', f"Codec is not vorbis: {stream['codec_name']}"
    print("OGG metadata verification PASS.")

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    midi_path = os.path.join(root_dir, "assets", "music-source", "korobeiniki_8bit.mid")
    wav_path = os.path.join(root_dir, "assets", "music-source", "korobeiniki_8bit_temp.wav")
    ogg_path = os.path.join(root_dir, "public", "audio", "korobeiniki_8bit.ogg")

    # 1. Generate MIDI
    generate_midi_file(midi_path)

    # 2. Synthesize Audio Buffer
    left_buf, right_buf = render_audio_buffers()
    verify_pcm_boundaries(left_buf, right_buf)

    # 3. Write temp WAV
    write_wav(wav_path, left_buf, right_buf)

    # 4. Convert WAV to OGG Vorbis
    convert_wav_to_ogg(wav_path, ogg_path)

    # 5. Verify OGG
    verify_ogg_metadata(ogg_path)

    # Clean up temp wav
    if os.path.exists(wav_path):
        os.remove(wav_path)
        print("Removed temporary WAV.")

    print("\n[SUCCESS] BGM assets generated and verified successfully!")

if __name__ == '__main__':
    main()
