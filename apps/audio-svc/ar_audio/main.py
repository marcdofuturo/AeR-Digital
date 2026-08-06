"""Audio analysis service — faster-whisper + librosa (Prompt 6)."""
from fastapi import FastAPI
from pydantic import BaseModel

from .analyze import download_audio, transcribe, analyze_signal

app = FastAPI(title="AeR Digital — Audio Service", version="0.1.0")


class AnalyzeRequest(BaseModel):
    audio_url: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_audio(req: AnalyzeRequest):
    """Full pipeline: download → transcribe (whisper) → signal (librosa)."""
    path = await download_audio(req.audio_url)

    transcript_result = transcribe(path)
    signal_result = analyze_signal(path)

    # Cleanup temp file
    try:
        path.unlink()
    except OSError:
        pass

    return {
        "transcript": transcript_result.get("transcript", ""),
        "segments": transcript_result.get("segments", []),
        **signal_result,
        "errors": [
            e for e in [transcript_result.get("error"), signal_result.get("error")]
            if e is not None
        ],
    }
