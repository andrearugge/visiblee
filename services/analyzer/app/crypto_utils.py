"""
AES-256-GCM encryption utility for GSC OAuth tokens.

Format: "<ivHex>:<authTagHex>:<ciphertextHex>"
Key:    GSC_TOKEN_ENCRYPTION_KEY env var — 64 hex chars (32 bytes).

Cross-compatible with lib/crypto.ts in the Next.js app.
Requires: cryptography>=41.0.0
"""

import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

_IV_BYTES = 16


def _get_key() -> bytes:
    hex_key = os.getenv("GSC_TOKEN_ENCRYPTION_KEY", "")
    if not hex_key or len(hex_key) != 64:
        raise RuntimeError(
            "GSC_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
        )
    return bytes.fromhex(hex_key)


def encrypt(plaintext: str) -> str:
    """Encrypt a string with AES-256-GCM. Returns '<ivHex>:<authTagHex>:<ciphertextHex>'."""
    key = _get_key()
    iv = os.urandom(_IV_BYTES)
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext.encode("utf-8")) + encryptor.finalize()
    auth_tag = encryptor.tag  # 16 bytes
    return f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"


def decrypt(encrypted_text: str) -> str:
    """Decrypt a string produced by encrypt() or the TypeScript counterpart."""
    parts = encrypted_text.split(":")
    if len(parts) != 3:
        raise ValueError("Invalid encrypted text format — expected '<iv>:<tag>:<ciphertext>'")
    iv_hex, auth_tag_hex, ciphertext_hex = parts
    key = _get_key()
    iv = bytes.fromhex(iv_hex)
    auth_tag = bytes.fromhex(auth_tag_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv, auth_tag))
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    return plaintext.decode("utf-8")
