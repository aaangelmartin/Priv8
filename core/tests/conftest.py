import os
import tempfile

# Los tests no escriben el registro real ni la clave del repo.
os.environ.setdefault("PRIV8_AUDIT", "off")
os.environ.setdefault("PRIV8_AUDIT_KEY", os.path.join(tempfile.mkdtemp(prefix="priv8-"), "priv8.key"))
