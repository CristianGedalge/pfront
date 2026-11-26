import { useEffect, useRef, useState } from 'react'
import './App.css'

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const money = value => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(value)
const blankProduct = { name: '', sku: '', category_id: '', price: '', stock: 0, description: '', active: true }
const blankCategory = { name: '', description: '' }

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API}/${path}`, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
  } catch { throw new Error('No se pudo conectar con el servidor. Comprueba que Laravel esté iniciado.') }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 422 ? 'Revisa los campos indicados.' : data.message || 'No se pudo completar la operación.')
    error.fields = data.errors || {}
    throw error
  }
  return data
}

function App() {
  const [page, setPage] = useState('products')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(blankProduct)
  const [fields, setFields] = useState({})
  const [saving, setSaving] = useState(false)
  const dialog = useRef(null)
  const opener = useRef(null)
  const isProduct = page === 'products'

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [p, c] = await Promise.all([request('products'), request('categories')])
      setProducts(p); setCategories(c)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (modal) dialog.current?.showModal()
    else { dialog.current?.close(); opener.current?.focus() }
  }, [modal])

  function navigate(next) { setPage(next); setSearch(''); setCategoryFilter(''); setStatusFilter('') }
  function open(item = null, action = 'edit') {
    opener.current = document.activeElement
    setFields({})
    setForm(item ? { ...item, category_id: item.category_id ?? '' } : { ...(isProduct ? blankProduct : blankCategory) })
    setModal({ action, item })
  }
  function close() { if (!saving) setModal(null) }
  async function save(event) {
    event.preventDefault()
    setSaving(true); setFields({})
    const resource = isProduct ? 'products' : 'categories'
    try {
      if (modal.action === 'delete') {
        await request(`${resource}/${modal.item.id}`, { method: 'DELETE' })
      } else {
        const payload = isProduct ? { name: form.name.trim(), sku: form.sku.trim(), description: form.description, category_id: Number(form.category_id), price: form.price, stock: Number(form.stock), active: form.active } : { name: form.name.trim(), description: form.description }
        await request(`${resource}${modal.item ? `/${modal.item.id}` : ''}`, { method: modal.item ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      }
      setModal(null)
      setNotice(modal.action === 'delete' ? 'Registro eliminado correctamente.' : 'Cambios guardados correctamente.')
      await load()
    } catch (e) { setFields({ ...e.fields, general: e.message }) }
    finally { setSaving(false) }
  }
  const filtered = (isProduct ? products : categories).filter(item => {
    const term = search.toLocaleLowerCase('es')
    return `${item.name} ${item.sku || ''} ${item.description || ''}`.toLocaleLowerCase('es').includes(term)
      && (!isProduct || !categoryFilter || String(item.category_id) === categoryFilter)
      && (!isProduct || !statusFilter || String(item.active) === statusFilter)
  })
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0)
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * Number(p.price), 0)
  function input(name, label, type = 'text', extra = {}) {
    return <label className="field">{label}<input name={name} type={type} value={form[name] ?? ''} onChange={e => setForm({ ...form, [name]: e.target.value })} aria-invalid={!!fields[name]} {...extra} />{fields[name] && <small className="field-error">{fields[name][0]}</small>}</label>
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('products') }}><span className="brand-mark">c.</span><span>catálogo<span className="brand-sub">GESTIÓN DE INVENTARIO</span></span></a>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav aria-label="Menú principal">
        <button className={isProduct ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('products')}><span aria-hidden="true">▦</span> Productos <b>{products.length}</b></button>
        <button className={!isProduct ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('categories')}><span aria-hidden="true">▤</span> Categorías <b>{categories.length}</b></button>
      </nav>
      <div className="sidebar-note"><span className="note-icon" aria-hidden="true">✦</span><strong>Todo en su lugar</strong><p>Un catálogo organizado empieza con los pequeños detalles.</p></div>
      <div className="profile"><span className="avatar">AD</span><div><strong>Administrador</strong><small>Mi espacio de trabajo</small></div></div>
    </aside>
    <main>
      <div className="breadcrumb">Mi espacio <span>/</span> <strong>{isProduct ? 'Productos' : 'Categorías'}</strong></div>
      <header className="page-header"><div><div className="eyebrow">TU CATÁLOGO, BAJO CONTROL</div><h1>{isProduct ? 'Productos' : 'Categorías'}<span>.</span></h1><p>{isProduct ? 'Administra tus productos y mantén el inventario al día.' : 'Organiza tus productos en categorías fáciles de encontrar.'}</p></div><button className="primary" onClick={() => open()} disabled={loading || (isProduct && categories.length === 0)}><span aria-hidden="true">＋</span> {isProduct ? 'Nuevo producto' : 'Nueva categoría'}</button></header>
      {notice && <div className="notice" role="status">✓ {notice}</div>}
      {error && <div className="error-banner" role="alert">{error}<button onClick={load}>Reintentar</button></div>}
      <section className="stats" aria-label="Resumen del inventario">
        <article><span>Total de productos</span><strong>{loading ? '—' : products.length}<i className="stat-icon" aria-hidden="true">▦</i></strong><small>En tu catálogo</small></article>
        <article><span>Categorías</span><strong>{loading ? '—' : categories.length}<i className="stat-icon purple" aria-hidden="true">▤</i></strong><small>Para mantener el orden</small></article>
        <article><span>Unidades disponibles</span><strong>{loading ? '—' : totalUnits}<i className="stat-icon orange" aria-hidden="true">≡</i></strong><small>{products.filter(p => p.stock < 10).length} productos con stock bajo</small></article>
        <article><span>Valor del inventario</span><strong className="money-stat">{loading ? '—' : money(inventoryValue)}</strong><small>Según precio de venta</small></article>
      </section>
      <section className="catalog-panel" aria-label={isProduct ? 'Lista de productos' : 'Lista de categorías'}>
        <div className="panel-heading"><h2>{isProduct ? 'Todos los productos' : 'Todas las categorías'} <span>{filtered.length}</span></h2><span className="panel-caption">Tu inventario en un solo lugar</span></div>
        <div className="filters"><label className="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar" placeholder={isProduct ? 'Buscar por nombre o SKU...' : 'Buscar categoría...'} value={search} onChange={e => setSearch(e.target.value)} /></label>{isProduct && <><select aria-label="Filtrar por categoría" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Filtrar por estado" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option></select></>}</div>
        {loading ? <div className="empty" role="status">Cargando tu catálogo…</div> : error ? <div className="empty">El catálogo estará disponible cuando se restablezca la conexión.</div> : filtered.length === 0 ? <div className="empty"><strong>{search || categoryFilter || statusFilter ? 'Sin resultados' : isProduct ? 'Tu catálogo está por comenzar' : 'Crea tu primera categoría'}</strong><p>{isProduct && categories.length === 0 ? 'Primero agrega una categoría para organizar tus productos.' : 'Agrega un registro o ajusta los filtros de búsqueda.'}</p>{isProduct && categories.length === 0 && <button className="primary" onClick={() => navigate('categories')}>Ir a categorías</button>}</div> : <div className="table-scroll"><table><thead><tr><th>{isProduct ? 'PRODUCTO' : 'CATEGORÍA'}</th>{isProduct ? <><th>CATEGORÍA</th><th>PRECIO</th><th>STOCK</th><th>ESTADO</th></> : <><th>DESCRIPCIÓN</th><th>PRODUCTOS</th></>}<th className="actions-heading">ACCIONES</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><strong className="item-name">{item.name}</strong><small className="item-code">{isProduct ? item.sku : `CAT-${String(item.id).padStart(3, '0')}`}</small></td>{isProduct ? <><td><span className="category-pill">{item.category?.name}</span></td><td className="price">{money(item.price)}</td><td><span className={item.stock === 0 ? 'stock zero' : item.stock < 10 ? 'stock low' : 'stock'}>{item.stock} <small>uds.</small></span></td><td><span className={`status ${item.active ? 'active' : ''}`}>{item.active ? 'Activo' : 'Inactivo'}</span></td></> : <><td className="description">{item.description || 'Sin descripción'}</td><td><span className="category-pill">{item.products_count} productos</span></td></>}<td><div className="actions"><button onClick={() => open(item)} aria-label={`Editar ${item.name}`}>Editar</button><button className="delete-action" onClick={() => open(item, 'delete')} aria-label={`Eliminar ${item.name}`}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
        <div className="table-footer"><span>{filtered.length} de {isProduct ? products.length : categories.length} {isProduct ? 'productos' : 'categorías'}</span><span>Organiza. Controla. Crece.</span></div>
      </section>
      <footer className="main-footer">catálogo <span>Hecho para simplificar tu día.</span></footer>
    </main>
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) close() }} aria-labelledby="dialog-title">
      {modal && <form onSubmit={save}>
        <div className="modal-header"><div><span className="eyebrow">GESTIONA TU CATÁLOGO</span><h2 id="dialog-title">{modal.action === 'delete' ? 'Eliminar' : modal.item ? 'Editar' : isProduct ? 'Nuevo' : 'Nueva'} {isProduct ? 'producto' : 'categoría'}</h2></div><button type="button" className="close" aria-label="Cerrar" onClick={close} disabled={saving}>×</button></div>
        {fields.general && <div className="error-banner" role="alert">{fields.general}</div>}
        {modal.action === 'delete' ? <p className="delete-message">¿Deseas eliminar <strong>{modal.item.name}</strong>? Esta acción no se puede deshacer.</p> : <div className="form-grid">
          {input('name', 'Nombre', 'text', { required: true, maxLength: isProduct ? 160 : 120, autoFocus: true })}
          {isProduct && <>{input('sku', 'Código SKU', 'text', { required: true, maxLength: 60 })}<label className="field">Categoría<select required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} aria-invalid={!!fields.category_id}><option value="">Selecciona una categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{fields.category_id && <small className="field-error">{fields.category_id[0]}</small>}</label><div className="form-row">{input('price', 'Precio (Bs)', 'number', { required: true, min: 0, max: 9999999999.99, step: '0.01' })}{input('stock', 'Existencias', 'number', { required: true, min: 0, max: 2147483647, step: 1 })}</div></>}
          <label className="field">Descripción <span className="optional">(opcional)</span><textarea rows="3" maxLength={2000} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />{fields.description && <small className="field-error">{fields.description[0]}</small>}</label>
          {isProduct && <label className="checkbox"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Producto activo</label>}
        </div>}
        <div className="modal-footer"><button type="button" className="secondary" onClick={close} disabled={saving}>Cancelar</button><button className={modal.action === 'delete' ? 'danger' : 'primary'} disabled={saving}>{saving ? 'Guardando…' : modal.action === 'delete' ? 'Sí, eliminar' : 'Guardar cambios'}</button></div>
      </form>}
    </dialog>
  </div>
}
export default App
