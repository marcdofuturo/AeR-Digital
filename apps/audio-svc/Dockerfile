FROM python:3.12-slim

WORKDIR /app

# System deps for librosa + faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY ar_audio/ ar_audio/

EXPOSE 8000
CMD ["uvicorn", "ar_audio.main:app", "--host", "0.0.0.0", "--port", "8000"]
