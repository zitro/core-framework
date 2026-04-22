"""Extension API loader."""

from pathlib import Path

from fastapi import FastAPI

from app.extensions import load_extensions


def test_load_extensions_missing_dir_is_noop(tmp_path: Path) -> None:
    app = FastAPI()
    loaded = load_extensions(app, str(tmp_path / "does-not-exist"), object())
    assert loaded == []


def test_load_extensions_calls_register(tmp_path: Path) -> None:
    plugin = tmp_path / "demo.py"
    plugin.write_text(
        "called = []\n"
        "def register(app, settings):\n"
        "    called.append(True)\n"
        "    app.state.demo_loaded = True\n"
    )
    app = FastAPI()
    loaded = load_extensions(app, str(tmp_path), object())
    assert loaded == ["demo"]
    assert getattr(app.state, "demo_loaded", False) is True


def test_load_extensions_skips_modules_without_register(tmp_path: Path) -> None:
    (tmp_path / "incomplete.py").write_text("# no register function\n")
    app = FastAPI()
    loaded = load_extensions(app, str(tmp_path), object())
    assert loaded == []


def test_load_extensions_skips_underscore_prefixed(tmp_path: Path) -> None:
    (tmp_path / "_private.py").write_text("def register(app, settings): app.state.private = True\n")
    app = FastAPI()
    loaded = load_extensions(app, str(tmp_path), object())
    assert loaded == []
    assert getattr(app.state, "private", False) is False


def test_load_extensions_failing_plugin_is_logged_not_fatal(tmp_path: Path) -> None:
    (tmp_path / "broken.py").write_text("raise RuntimeError('boom')\n")
    (tmp_path / "good.py").write_text("def register(app, settings): app.state.good = True\n")
    app = FastAPI()
    loaded = load_extensions(app, str(tmp_path), object())
    assert loaded == ["good"]
    assert getattr(app.state, "good", False) is True
