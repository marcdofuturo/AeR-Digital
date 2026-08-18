"""Audio analysis using faster-whisper + librosa (Prompt 6)."""
from __future__ import annotations

import ipaddress
import os
import tempfile
import uuid
from functools import lru_cache
from pathlib import Path
from urllib.parse import ParseResult, urlparse

import httpx

DEFAULT_AUDIO_HOSTS = (
    "dwqdpumeehcamnrbddad.supabase.co",
    "evolution.193-203-182-39.sslip.io",
)


def validate_audio_url(url: str) -> ParseResult:
    """Allow only HTTPS audio URLs from explicitly configured storage hosts."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("invalid audio URL")

    hostname = parsed.hostname.lower().rstrip(".")
    try:
        address = ipaddress.ip_address(hostname)
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValueError("private audio host")
    except ValueError as error:
        if str(error) == "private audio host":
            raise

    configured = os.getenv("AUDIO_ALLOWED_HOSTS", ",".join(DEFAULT_AUDIO_HOSTS))
    allowed_hosts = [host.strip().lower().rstrip(".") for host in configured.split(",") if host.strip()]
    if not any(hostname == host or hostname.endswith(f".{host}") for host in allowed_hosts):
        raise ValueError("audio host not allowed")
    return parsed


async def download_audio(url: str) -> Path:
    """Download audio file to temp directory."""
    parsed = validate_audio_url(url)
    max_bytes = int(os.getenv("AUDIO_MAX_BYTES", str(512 * 1024 * 1024)))

    suffix = ".mp3"
    if parsed.path.lower().endswith(".wav"):
        suffix = ".wav"
    elif parsed.path.lower().endswith(".flac"):
        suffix = ".flac"

    tmp = Path(tempfile.gettempdir()) / f"ar_audio_{uuid.uuid4().hex}{suffix}"
    downloaded = 0
    try:
        async with httpx.AsyncClient(timeout=300, follow_redirects=False) as client:
            async with client.stream("GET", parsed.geturl()) as response:
                response.raise_for_status()
                content_length = int(response.headers.get("content-length", "0") or 0)
                if content_length > max_bytes:
                    raise ValueError("audio file too large")
                with tmp.open("wb") as output:
                    async for chunk in response.aiter_bytes():
                        downloaded += len(chunk)
                        if downloaded > max_bytes:
                            raise ValueError("audio file too large")
                        output.write(chunk)
        return tmp
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


@lru_cache(maxsize=1)
def get_whisper_model():
    """Load the configured Whisper model once per service process."""
    from faster_whisper import WhisperModel

    model_name = os.getenv("WHISPER_MODEL", "large-v3-turbo").strip() or "large-v3-turbo"
    return WhisperModel(model_name, device="cpu", compute_type="int8")


def transcribe(path: str | Path) -> dict:
    """Transcribe Brazilian Portuguese audio with the cached Whisper model."""
    try:
        model = get_whisper_model()
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


def scalar_float(value: object) -> float:
    """Convert scalar-like values, including single-value NumPy arrays, to float."""
    item = getattr(value, "item", None)
    return float(item()) if callable(item) else float(value)


def analyze_signal(path: str | Path) -> dict:
    """Extract BPM, key, energy, brightness, hook position using librosa."""
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(str(path), sr=22050, mono=True)
        duration = len(y) / sr

        # Tempo (BPM)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = scalar_float(tempo) if tempo is not None else 0

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
