import re
import unicodedata


def slugify(value: str, max_length: int = 255) -> str:
    """Ubah nama produk menjadi slug URL: "Figur Gojo 30cm!" -> "figur-gojo-30cm"."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value[:max_length].strip("-")
