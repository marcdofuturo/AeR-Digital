"""Audio analysis using faster-whisper + librosa (Prompt 6)."""
from __future__ import annotations

import tempfile
from pathlib import Path

import httpx
import numpy as np


async def download_audio(url: str) -> Path:
    """Download audio file to temp directory."""
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    suffix = ".mp3"
    if ".wav" in url.lower():
        suffix = ".wav"
    elif ".flac" in url.lower():
        suffix = ".flac"

    tmp = Path(tempfile.gettempdir()) / f"ar_audio_{hash(url)}{suffix}"
    tmp.write_bytes(resp.content)
    return tmp


def transcribe(path: str | Path) -> dict:
    """Transcribe audio using faster-whisper large-v3 (pt-BR)."""
    try:
        from faster_whisper import WhisperModel

        model = WhisperModel("large-v3", device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(
            str(path),
            language="pt",
            vad_filter=True,
            initial_prompt="Letra de música brasileira. Funk, trap, rap.",
        )
        segments = [
            {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments_iter
        ]
        return {"transcript": " ".join(s["text"] for s in segments), "segments": segments}
    except Exception as e:
        return {"transcript": "", "segments": [], "error": str(e)}


def analyze_signal(path: str | Path) -> dict:
    """Extract BPM, key, energy, brightness, hook position using librosa."""
    try:
        import librosa

        y, sr = librosa.load(str(path), sr=22050, mono=True)
        duration = len(y) / sr

        # Tempo (BPM)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo) if tempo is not None else 0

        # Chroma → key estimate
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_idx = int(np.argmax(np.mean(chroma, axis=1)))
        keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        key = keys[key_idx]

        # Mode (major/minor) — simplified heuristic
        major_profile = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
        minor_profile = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
        mean_chroma = np.mean(chroma, axis=1)
        major_corr = np.corrcoef(mean_chroma, major_profile)[0,1] if not np.isnan(np.corrcoef(mean_chroma, major_profile)[0,1]) else 0
        minor_corr = np.corrcoef(mean_chroma, minor_profile)[0,1] if not np.isnan(np.corrcoef(mean_chroma, minor_profile)[0,1]) else 0
        mode = "major" if major_corr > minor_corr else "minor"

        # Energy (RMS)
        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))

        # Brightness (spectral centroid)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        brightness = float(np.mean(centroid))

        # Hook detection: peak onset strength in middle section
        onset = librosa.onset.onset_strength(y=y, sr=sr)
        middle_start = len(onset) // 3
        hook_frame = int(np.argmax(onset[middle_start:]) + middle_start)
        hook_at_sec = round((hook_frame * 512) / sr, 1)

        return {
            "bpm": round(bpm, 1),
            "key": key,
            "mode": mode,
            "energy": round(min(energy * 10, 1.0), 2),  # normalize
            "brightness": round(min(brightness / 5000, 1.0), 2),
            "duration": round(duration, 1),
            "hook_at_sec": hook_at_sec,
        }
    except Exception as e:
        return {
            "bpm": 0, "key": "C", "mode": "major",
            "energy": 0, "brightness": 0, "duration": 0, "hook_at_sec": 0,
            "error": str(e),
        }
