"""QR generation — PNG, SVG, ZPL.

Encodes the GS1 Digital Link URL with error-correction level Q (durable enough
for warehouse handling per SDD §6.1 step 4). PNG and SVG via the `qrcode`
library; ZPL is hand-rendered for direct casthouse label printers.
"""

from __future__ import annotations

import io

import qrcode
from qrcode.constants import ERROR_CORRECT_Q
from qrcode.image.svg import SvgPathImage


def png_bytes(payload: str, *, box_size: int = 10, border: int = 2) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_Q,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0A0908", back_color="#F5F1E8")
    out = io.BytesIO()
    img.save(out, format="PNG")  # type: ignore[call-arg]
    return out.getvalue()


def svg_bytes(payload: str, *, border: int = 2) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_Q,
        box_size=10,
        border=border,
        image_factory=SvgPathImage,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    out = io.BytesIO()
    qr.make_image().save(out)
    return out.getvalue()


def zpl(payload: str, *, x: int = 50, y: int = 50, magnification: int = 6) -> str:
    """Zebra ZPL II command stream — ready for direct printer transmission."""
    return f"^XA^FO{x},{y}^BQN,2,{magnification}^FDQA,{payload}^FS^XZ"
