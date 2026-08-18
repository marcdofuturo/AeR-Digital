from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_audio_package_is_present_before_wheel_install() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert dockerfile.index("COPY ar_audio/") < dockerfile.index("RUN pip install")


def test_hatch_wheel_declares_the_audio_package() -> None:
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert '[tool.hatch.build.targets.wheel]' in pyproject
    assert 'packages = ["ar_audio"]' in pyproject


def test_audio_container_runs_as_non_root_with_a_healthcheck() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    compose = (ROOT.parents[1] / "infra" / "docker-compose.yml").read_text(encoding="utf-8")

    assert "USER app" in dockerfile
    assert "HEALTHCHECK" in dockerfile
    assert "condition: service_healthy" in compose


def test_worker_host_port_does_not_collide_with_legacy_crm() -> None:
    compose = (ROOT.parents[1] / "infra" / "docker-compose.yml").read_text(encoding="utf-8")

    assert '"127.0.0.1:${WORKER_HOST_PORT:-3002}:3001"' in compose
