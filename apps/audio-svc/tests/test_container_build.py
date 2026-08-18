import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_PATH = ROOT.parents[1] / "infra" / "docker-compose.yml"


def load_compose_config() -> dict:
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_PATH), "config", "--format", "json"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_audio_package_is_present_before_wheel_install() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert dockerfile.index("COPY ar_audio/") < dockerfile.index("RUN pip install")


def test_hatch_wheel_declares_the_audio_package() -> None:
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert '[tool.hatch.build.targets.wheel]' in pyproject
    assert 'packages = ["ar_audio"]' in pyproject


def test_audio_container_runs_as_non_root_with_a_healthcheck() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    compose = COMPOSE_PATH.read_text(encoding="utf-8")

    assert "USER app" in dockerfile
    assert "HEALTHCHECK" in dockerfile
    assert "condition: service_healthy" in compose


def test_worker_host_port_does_not_collide_with_legacy_crm() -> None:
    worker = load_compose_config()["services"]["worker"]
    port = worker["ports"][0]

    assert port["host_ip"] == "127.0.0.1"
    assert port["published"] == "3002"
    assert port["target"] == 3001


def test_bullmq_has_a_dedicated_non_evicting_redis() -> None:
    services = load_compose_config()["services"]
    evolution_redis = services["redis"]
    worker_redis = services["worker-redis"]
    worker = services["worker"]

    assert "allkeys-lru" in evolution_redis["command"]
    assert "noeviction" in worker_redis["command"]
    assert worker["environment"]["REDIS_URL"] == "redis://ar-worker-redis:6379"
    assert worker["depends_on"]["worker-redis"]["condition"] == "service_healthy"
    assert "redis-cli" in " ".join(worker_redis["healthcheck"]["test"])
