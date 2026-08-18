FROM python:3.12-slim

WORKDIR /app

# System deps for librosa + faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY ar_audio/ ar_audio/
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "ar_audio.main:app", "--host", "0.0.0.0", "--port", "8000"]
