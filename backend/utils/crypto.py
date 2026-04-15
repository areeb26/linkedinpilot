import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def decrypt_credentials(encrypted_text: str, secret_key: str) -> str:
    """
    Decrypts AES-GCM encrypted text used in LinkedPilot.
    Format: iv_base64:content_base64
    The content includes the 16-byte auth tag at the end (Web Crypto style).
    """
    try:
        if not encrypted_text or ":" not in encrypted_text:
            return encrypted_text # Return as is if not matching format

        iv_b64, content_b64 = encrypted_text.split(':')
        iv = base64.b64decode(iv_b64)
        content = base64.b64decode(content_b64)
        
        # In Web Crypto / AESGCM, the tag is usually the last 16 bytes
        # cryptography.AESGCM expects (iv, ciphertext_with_tag, associated_data)
        
        aesgcm = AESGCM(secret_key.encode('utf-8'))
        decrypted = aesgcm.decrypt(iv, content, None)
        
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Decryption error: {e}")
        return ""

def encrypt_credentials(text: str, secret_key: str) -> str:
    """
    Encrypts text using AES-GCM to match LinkedPilot format.
    """
    try:
        aesgcm = AESGCM(secret_key.encode('utf-8'))
        iv = os.urandom(12)
        encrypted = aesgcm.encrypt(iv, text.encode('utf-8'), None)
        
        iv_b64 = base64.b64encode(iv).decode('utf-8')
        content_b64 = base64.b64encode(encrypted).decode('utf-8')
        
        return f"{iv_b64}:{content_b64}"
    except Exception as e:
        print(f"Encryption error: {e}")
        return ""
