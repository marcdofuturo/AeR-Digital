FROM python:3.12-slim

WORKDIR /app

# System deps for librosa + faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app \
    && mkdir -p /tmp/audio \
    && chown app:app /tmp/audio

COPY ar_audio/ ar_audio/
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
USER app
CMD ["uvicorn", "ar_audio.main:app", "--host", "0.0.0.0", "--port", "8000"]
