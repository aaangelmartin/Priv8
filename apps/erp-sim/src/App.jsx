// ERP Alba Core simulado (#16). Un ERP antiguo, sin API: el agente solo lo usa a
// través de la pantalla. Los datos salen de data/seed.json.
//
// Contrato con el adaptador web (adapters/web): solo entra en el snapshot lo que
// lleva data-p8="<role>" (roles de common.schema.json). El selector es "#id";
// data-p8-label da la etiqueta y data-p8-actions sustituye a las acciones por
// defecto del rol. Los id son estables: las políticas (policies/alba-core.yaml)
// y la escena b2b de core/scenes.py usan los mismos.
import React, { useEffect, useState } from 'react'
import seed from '../../../data/seed.json'

const ERP = seed.erp
const KEY = 'alba-core'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* sin almacenamiento: el estado vive solo en memoria */
  }
}

function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  const go = (to) => {
    history.pushState(null, '', to)
    setPath(to)
  }
  return [path, go]
}

function Link({ id, to, go, children, p8 = 'link' }) {
  return (
    <a
      id={id}
      href={to}
      data-p8={p8}
      onClick={(e) => {
        e.preventDefault()
        go(to)
      }}
    >
      {children}
    </a>
  )
}

export default function App() {
  const [path, go] = usePath()
  const [state, setState] = useState(load)
  const update = (patch) => {
    const next = { ...state, ...patch }
    setState(next)
    save(next)
  }

  if (path === '/reset') {
    save({})
    location.replace('/login')
    return null
  }
  if (!state.usuario && path !== '/login') {
    history.replaceState(null, '', '/login')
    return <Login onLogin={(u) => update({ usuario: u })} go={go} />
  }

  let page
  if (path === '/login') page = <Login onLogin={(u) => update({ usuario: u })} go={go} />
  else if (path === '/' || path === '/facturas/alta') page = <AltaFactura state={state} update={update} go={go} />
  else if (path === '/facturas') page = <Facturas state={state} go={go} />
  else if (path === '/proveedores') page = <Proveedores go={go} />
  else if (path.startsWith('/proveedores/')) page = <Ficha id={Number(path.split('/')[2])} go={go} />
  else page = <p className="vacio">Pantalla no encontrada.</p>

  if (path === '/login') return page
  return (
    <Ventana usuario={state.usuario} go={go} onSalir={() => update({ usuario: null })}>
      {page}
    </Ventana>
  )
}

function Ventana({ usuario, go, onSalir, children }) {
  const persona = ERP.usuarios.find((u) => u.usuario === usuario)
  return (
    <div className="ventana">
      <div className="titulo">
        <span>Alba Core {ERP.version} · {seed.empresa.nombre}</span>
        <span className="botones-ventana" aria-hidden="true">
          <i>_</i>
          <i>□</i>
          <i>×</i>
        </span>
      </div>
      <nav className="menu">
        <span className="menu-grupo">Compras:</span>
        <Link id="menu-alta" to="/facturas/alta" go={go} p8="menuitem">
          Alta de factura
        </Link>
        <Link id="menu-facturas" to="/facturas" go={go} p8="menuitem">
          Facturas recibidas
        </Link>
        <Link id="menu-proveedores" to="/proveedores" go={go} p8="menuitem">
          Proveedores
        </Link>
        <span className="menu-gris">Ventas</span>
        <span className="menu-gris">Contabilidad</span>
        <span className="menu-gris">Ayuda</span>
      </nav>
      <main className="cuerpo">{children}</main>
      <footer className="estado">
        <span>Usuario: {persona ? persona.nombre : usuario}</span>
        <span>Empresa 01 · Ejercicio 2026</span>
        <button className="salir" onClick={onSalir}>
          Cerrar sesión
        </button>
      </footer>
    </div>
  )
}

function Login({ onLogin, go }) {
  const [u, setU] = useState('')
  const [c, setC] = useState('')
  const [error, setError] = useState('')
  const entrar = (e) => {
    e.preventDefault()
    const ok = ERP.usuarios.find((x) => x.usuario === u && x.clave === c)
    if (!ok) return setError('Usuario o clave incorrectos.')
    onLogin(u)
    go('/facturas/alta')
  }
  return (
    <div className="login-fondo">
      <form className="ventana login" onSubmit={entrar}>
        <div className="titulo">
          <span>Alba Core {ERP.version} · Acceso</span>
        </div>
        <div className="cuerpo">
          <h1 id="login-titulo" data-p8="heading">
            Identificación
          </h1>
          <label htmlFor="usuario">Usuario</label>
          <input id="usuario" data-p8="textbox" data-p8-label="Usuario" value={u} onChange={(e) => setU(e.target.value)} autoComplete="off" />
          <label htmlFor="clave">Clave</label>
          <input id="clave" type="password" data-p8="textbox" data-p8-label="Clave" value={c} onChange={(e) => setC(e.target.value)} />
          {error && (
            <p id="login-error" className="error" data-p8="text">
              {error}
            </p>
          )}
          <button id="entrar" data-p8="button" type="submit">
            Entrar
          </button>
          <p className="pista">Demo: {ERP.usuarios[0].usuario} / {ERP.usuarios[0].clave}</p>
        </div>
      </form>
    </div>
  )
}

function Campo({ id, label, value, onChange, readOnly, actions }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-p8="textbox"
        data-p8-label={label}
        data-p8-actions={readOnly ? '' : actions}
        value={value}
        readOnly={readOnly}
        onChange={onChange && ((e) => onChange(e.target.value))}
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  )
}

function AltaFactura({ state, update, go }) {
  const pedido = ERP.pedidos.find((p) => p.estado === 'Recibido') || ERP.pedidos[0]
  const prov = ERP.proveedores.find((p) => p.id === pedido.proveedor)
  const [num, setNum] = useState('')
  const [importe, setImporte] = useState('')
  const [iban, setIban] = useState(prov.iban)
  const [aviso, setAviso] = useState('')

  const registrar = () => {
    if (!num.trim() || !importe.trim()) {
      setAviso('Faltan datos: número e importe son obligatorios')
      return
    }
    const factura = {
      numero: num.trim(),
      proveedor: prov.id,
      pedido: pedido.numero,
      fecha: new Date().toISOString().slice(0, 10),
      importe: importe.trim(),
      iban: iban.trim(),
      estado: 'Pendiente de pago',
    }
    update({ registradas: [...(state.registradas || []), factura] })
    setAviso('Factura registrada')
  }

  return (
    <section className="ficha">
      <h1 id="alta-titulo" data-p8="heading">
        Alta de factura de proveedor
      </h1>
      <fieldset>
        <legend>Pedido</legend>
        <p className="dato">
          <span>Pedido</span>
          <b id="pedido" data-p8="text" data-p8-label="Pedido">
            {pedido.numero}
          </b>
        </p>
        <p className="dato">
          <span>Importe del pedido</span>
          <b id="importe-pedido" data-p8="text" data-p8-label="Importe del pedido">
            {pedido.importe}
          </b>
        </p>
      </fieldset>
      <fieldset>
        <legend>Proveedor</legend>
        <Campo id="proveedor" label="Proveedor" value={prov.nombre} readOnly />
        <Campo id="cif" label="CIF" value={prov.cif} readOnly />
        <Link id="ver-proveedor" to={`/proveedores/${prov.id}`} go={go}>
          Ver ficha del proveedor
        </Link>
      </fieldset>
      <fieldset>
        <legend>Factura</legend>
        <Campo id="num-factura" label="Número de factura" value={num} onChange={setNum} actions="type" />
        <Campo id="importe" label="Importe" value={importe} onChange={setImporte} actions="type" />
        <Campo id="pago-iban" label="IBAN de pago" value={iban} onChange={setIban} actions="type" />
      </fieldset>
      <div className="acciones">
        <button id="registrar" data-p8="button" onClick={registrar}>
          Registrar
        </button>
      </div>
      {aviso && (
        <p id="aviso" className={aviso === 'Factura registrada' ? 'ok' : 'error'} data-p8="text" role="status">
          {aviso}
        </p>
      )}
    </section>
  )
}

function Ficha({ id, go }) {
  const p = ERP.proveedores.find((x) => x.id === id)
  if (!p) return <p className="vacio">Proveedor no encontrado.</p>
  return (
    <section className="ficha">
      <h1 id="ficha-titulo" data-p8="heading">
        Ficha de proveedor
      </h1>
      <fieldset>
        <legend>Datos maestros</legend>
        <Dato id="codigo" label="Código" value={String(p.id).padStart(5, '0')} />
        <Dato id="nombre" label="Nombre" value={p.nombre} />
        <Dato id="cif-prov" label="CIF" value={p.cif} />
        <Dato id="iban" label="IBAN" value={p.iban} />
        <Dato id="telefono" label="Teléfono" value={p.telefono} actions="call" />
        <Dato id="email" label="Correo" value={p.email} />
        <Dato id="categoria" label="Categoría" value={p.categoria} />
        <Dato id="alta" label="Alta" value={p.alta} />
      </fieldset>
      <div className="acciones">
        <Link id="volver" to="/facturas/alta" go={go}>
          Volver a la factura
        </Link>
      </div>
    </section>
  )
}

function Dato({ id, label, value, actions }) {
  return (
    <p className="dato">
      <span>{label}</span>
      <b id={id} data-p8="text" data-p8-label={label} data-p8-actions={actions}>
        {value}
      </b>
    </p>
  )
}

function Proveedores({ go }) {
  return (
    <section className="ficha">
      <h1 id="proveedores-titulo" data-p8="heading">
        Proveedores
      </h1>
      <table className="rejilla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>CIF</th>
            <th>Categoría</th>
          </tr>
        </thead>
        <tbody>
          {ERP.proveedores.map((p) => (
            <tr key={p.id}>
              <td>{String(p.id).padStart(5, '0')}</td>
              <td>
                <Link id={`prov-${p.id}`} to={`/proveedores/${p.id}`} go={go}>
                  {p.nombre}
                </Link>
              </td>
              <td>{p.cif}</td>
              <td>{p.categoria}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Facturas({ state }) {
  const todas = [...ERP.facturas, ...(state.registradas || [])]
  const nombre = (id) => ERP.proveedores.find((p) => p.id === id)?.nombre ?? id
  return (
    <section className="ficha">
      <h1 id="facturas-titulo" data-p8="heading">
        Facturas recibidas
      </h1>
      <table className="rejilla">
        <thead>
          <tr>
            <th>Número</th>
            <th>Proveedor</th>
            <th>Pedido</th>
            <th>Fecha</th>
            <th className="num">Importe</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {todas.map((f, i) => (
            <tr key={i} id={`factura-${i}`} data-p8="row" data-p8-label={`Factura ${f.numero}`}>
              <td>{f.numero}</td>
              <td>{nombre(f.proveedor)}</td>
              <td>{f.pedido}</td>
              <td>{f.fecha}</td>
              <td className="num">{f.importe}</td>
              <td>{f.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
