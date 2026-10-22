"""Storage interface and confined local implementation with integrity checks."""

from abc import ABC, abstractmethod
import hashlib
from pathlib import Path

from app.core.config import settings
from app.core.errors import api_error


class ArtifactStorage(ABC):
    @abstractmethod
    def resolve(self, key: str) -> Path: ...

    @abstractmethod
    def put(self, key: str, content: bytes) -> Path: ...

    @abstractmethod
    def checksum(self, key: str) -> str: ...


class LocalArtifactStorage(ArtifactStorage):
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if path == self.root or not path.is_relative_to(self.root):
            raise api_error(400, "UNSAFE_PATH", "Artifact path is outside storage.")
        return path

    def key(self, path: Path | str) -> str:
        path = Path(path).resolve()
        if not path.is_relative_to(self.root):
            raise api_error(400, "UNSAFE_PATH", "Artifact path is outside storage.")
        return path.relative_to(self.root).as_posix()

    def put(self, key: str, content: bytes) -> Path:
        path = self.resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    def checksum(self, key: str) -> str:
        digest = hashlib.sha256()
        with self.resolve(key).open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    def verified(self, key: str, checksum: str) -> Path:
        path = self.resolve(key)
        if not path.is_file():
            raise api_error(404, "ARTIFACT_MISSING", "Artifact is unavailable.")
        if self.checksum(key) != checksum:
            raise api_error(409, "ARTIFACT_CORRUPTED", "Artifact checksum verification failed.")
        return path


storage = LocalArtifactStorage(settings.artifact_root)
