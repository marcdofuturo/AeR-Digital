import sys
from types import SimpleNamespace

import pytest

from ar_audio import analyze


class FakeSegment:
    start = 0.0
    end = 1.0
    text = " letra "


@pytest.fixture(autouse=True)
def clear_model_cache():
    if hasattr(analyze, "get_whisper_model"):
        analyze.get_whisper_model.cache_clear()
    yield
    if hasattr(analyze, "get_whisper_model"):
        analyze.get_whisper_model.cache_clear()


def install_fake_whisper(monkeypatch, created_models):
    class FakeWhisperModel:
        def __init__(self, model_name, **_kwargs):
            created_models.append(model_name)

        def transcribe(self, *_args, **_kwargs):
            return iter([FakeSegment()]), SimpleNamespace()

    monkeypatch.setitem(
        sys.modules,
        "faster_whisper",
        SimpleNamespace(WhisperModel=FakeWhisperModel),
    )


def test_transcribe_reuses_the_loaded_model(monkeypatch, tmp_path):
    created_models = []
    install_fake_whisper(monkeypatch, created_models)
    monkeypatch.setenv("WHISPER_MODEL", "large-v3-turbo")
    audio_path = tmp_path / "track.wav"

    analyze.transcribe(audio_path)
    analyze.transcribe(audio_path)

    assert created_models == ["large-v3-turbo"]


def test_transcribe_uses_the_configured_model(monkeypatch, tmp_path):
    created_models = []
    install_fake_whisper(monkeypatch, created_models)
    monkeypatch.setenv("WHISPER_MODEL", "small")

    analyze.transcribe(tmp_path / "track.wav")

    assert created_models == ["small"]
