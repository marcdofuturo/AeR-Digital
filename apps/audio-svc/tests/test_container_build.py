from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_audio_package_is_present_before_wheel_install() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert dockerfile.index("COPY ar_audio/") < dockerfile.index("RUN pip install")


def test_hatch_wheel_declares_the_audio_package() -> None:
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert '[tool.hatch.build.targets.wheel]' in pyproject
    assert 'packages = ["ar_audio"]' in pyproject
