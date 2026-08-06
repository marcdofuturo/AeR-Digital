"""Audio analysis service — faster-whisper + librosa (Prompt 6)"""
from fastapi import FastAPI

app = FastAPI(title="AeR Digital — Audio Service", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_audio():
    """POST /analyze { audio_url } → { transcript, bpm, key, energy, hook_at_sec }"""
    return {
        "transcript": "",
        "segments": [],
        "bpm": 0,
        "key": "C",
        "mode": "major",
        "energy": 0.0,
        "brightness": 0.0,
        "duration": 0,
        "hook_at_sec": 0,
        "status": "not_implemented",
    }
