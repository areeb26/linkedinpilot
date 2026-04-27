import logging
import sys

def setup_logger(name="LinkedPilot"):
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # Console handler - use utf-8 encoding on Windows to avoid UnicodeEncodeError
        ch = logging.StreamHandler(sys.stdout)
        if hasattr(sys.stdout, 'reconfigure'):
            try:
                sys.stdout.reconfigure(encoding='utf-8')
            except Exception:
                pass
        ch.setFormatter(formatter)
        logger.addHandler(ch)

    return logger

logger = setup_logger()
