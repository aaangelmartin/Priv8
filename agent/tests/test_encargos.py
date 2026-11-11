"""Requests to register the invoice get the built-in task, whatever names they carry."""

from agent import agent as A



def test_register_requests_use_the_built_in_task():
    full = A.TASKS["registrar factura"]
    for t in ["registrar factura", "Registra la factura de Suministros Lumen",
              "Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen"]:
        assert A.expand_task(t) == full
    assert A.expand_task("Contesta al proveedor") == "Contesta al proveedor"
