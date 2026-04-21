"""Tests for the binary-file -> markdown extractor."""

import io

import pytest

from app.utils.file_extract import (
    SUPPORTED_EXTENSIONS,
    ExtractionError,
    UnsupportedFileTypeError,
    extract_to_markdown,
)


def test_extract_text_plain():
    out = extract_to_markdown("notes.txt", b"hello\nworld")
    assert out == "hello\nworld"


def test_extract_markdown_passthrough():
    src = b"# Title\n\nbody"
    assert extract_to_markdown("doc.md", src) == "# Title\n\nbody"


def test_unsupported_extension_raises():
    with pytest.raises(UnsupportedFileTypeError):
        extract_to_markdown("image.png", b"binary")


def test_no_extension_raises():
    with pytest.raises(UnsupportedFileTypeError):
        extract_to_markdown("README", b"x")


def test_empty_text_raises_extraction_error():
    with pytest.raises(ExtractionError):
        extract_to_markdown("notes.txt", b"")


def test_supported_extensions_set():
    # Smoke: ensure the set is what callers/UIs depend on
    assert {".pdf", ".docx", ".pptx", ".xlsx", ".md", ".txt"} <= SUPPORTED_EXTENSIONS


def test_extract_docx_minimal():
    docx = pytest.importorskip("docx")
    doc = docx.Document()
    doc.add_heading("Hello", level=1)
    doc.add_paragraph("body text")
    buf = io.BytesIO()
    doc.save(buf)
    out = extract_to_markdown("d.docx", buf.getvalue())
    assert "# Hello" in out
    assert "body text" in out


def test_extract_xlsx_minimal():
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["a", "b"])
    ws.append([1, 2])
    buf = io.BytesIO()
    wb.save(buf)
    out = extract_to_markdown("s.xlsx", buf.getvalue())
    assert "## Sheet1" in out
    assert "| a | b |" in out
    assert "| 1 | 2 |" in out
