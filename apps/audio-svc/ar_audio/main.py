"""FastAPI app for audio analysis — whisper transcription + librosa signal analysis."""

from fastapi import FastAPI

app = FastAPI(title="AeR Digital — Audio Service", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_audio():
    """Analyze an audio file: transcription, BPM, key, energy, hook detection."""
    return {"status": "not_implemented"}
