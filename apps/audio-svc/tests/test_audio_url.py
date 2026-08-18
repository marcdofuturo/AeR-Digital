import pytest

from ar_audio.analyze import validate_audio_url


def test_allows_configured_https_audio_host(monkeypatch):
    monkeypatch.setenv("AUDIO_ALLOWED_HOSTS", "example.supabase.co,evolution.example.com")
    assert validate_audio_url("https://example.supabase.co/storage/v1/object/public/file.mp3").hostname == "example.supabase.co"


@pytest.mark.parametrize(
    "url",
    [
        "http://example.supabase.co/file.mp3",
        "https://localhost/file.mp3",
        "https://127.0.0.1/file.mp3",
        "https://attacker.example/file.mp3",
        "file:///etc/passwd",
    ],
)
def test_rejects_untrusted_or_non_https_audio_urls(monkeypatch, url):
    monkeypatch.setenv("AUDIO_ALLOWED_HOSTS", "example.supabase.co")
    with pytest.raises(ValueError):
        validate_audio_url(url)
