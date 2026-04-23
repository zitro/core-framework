"""slugify — URL/FS-safe project slug derivation."""

from app.utils.slug import slugify


def test_simple_lowercase() -> None:
    assert slugify("Acme Inc") == "acme-inc"


def test_collapses_punctuation() -> None:
    assert slugify("Hello, World!!") == "hello-world"


def test_strips_leading_trailing_hyphens() -> None:
    assert slugify("---hi---") == "hi"


def test_empty_falls_back() -> None:
    assert slugify("") == "project"
    assert slugify("!!!") == "project"


def test_caps_at_64_chars() -> None:
    out = slugify("a" * 200)
    assert len(out) == 64
