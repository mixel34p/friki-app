import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './LegalPage.css'

import { documents, credits, libraryCredits } from '../lib/legalContent'

export default function LegalPage() {
  const { pathname } = useLocation()
  const key = pathname === '/credits' ? 'credits' : pathname === '/privacy' ? 'privacy' : pathname === '/community-guidelines' ? 'community' : 'terms'
  const doc = key === 'credits' ? credits : documents[key]
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const sections = (doc.sections || []).map(([number]) => document.getElementById(`legal-${number}`)).filter(Boolean)
    if (!sections.length) return undefined
    setActiveSection(doc.sections[0][0])
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveSection(visible[0].target.id.replace('legal-', ''))
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 })
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [key])

  return <div className="legal-page">
    <div className="legal-shell">
      <aside className="legal-sidebar">
        <span className="legal-sidebar-label">LEGAL</span>
        {Object.entries(documents).map(([id, item]) => <div className="legal-sidebar-document" key={id}>
          <Link to={item.path} className={id === key ? 'active' : ''} aria-current={id === key ? 'page' : undefined}>{item.label}</Link>
          {id === key && <nav aria-label={`Secciones: ${item.label}`}>{item.sections.map(([number, title]) => <a key={number} href={`#legal-${number}`} className={`legal-sidebar-section ${activeSection === number ? 'active' : ''}`} aria-current={activeSection === number ? 'location' : undefined}>{number}. {title}</a>)}</nav>}
        </div>)}
        <Link to={credits.path} className={`legal-sidebar-extra${key === 'credits' ? ' active' : ''}`} aria-current={key === 'credits' ? 'page' : undefined}>{credits.label}</Link>
      </aside>
      <div className="legal-layout">
        <article className="legal-article">
          <header className="legal-heading"><h1>{doc.title}</h1>{doc.updated ? <p>Última actualización: {doc.updated}</p> : <p>{doc.intro}</p>}</header>
          {key === 'credits' ? <div className="credits-list">
            <div className="credits-group"><h2>Fuentes y servicios</h2>
              <p><a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a> para el catálogo de anime; <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB</a> para videojuegos; <a href="https://giphy.com" target="_blank" rel="noreferrer">GIPHY</a> para GIFs; y <a href="https://mymemory.translated.net" target="_blank" rel="noreferrer">MyMemory</a> para traducciones.</p>
              <p><a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts</a> (Space Grotesk e Inter), <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>, <a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel</a> e <a href="https://imgbb.com" target="_blank" rel="noreferrer">ImgBB</a>.</p>
            </div>
            <div className="credits-group"><h2>Librerías y herramientas</h2>
              <p className="credits-library-list">{libraryCredits.map(([name, url], index) => <span key={name}><a href={url} target="_blank" rel="noreferrer">{name}</a>{index < libraryCredits.length - 1 ? ' · ' : ''}</span>)}</p>
            </div>
            <div className="credits-group"><h2>Inspiración de interfaz</h2>
              <p><a href="https://sharespotapp.com" target="_blank" rel="noreferrer">ShareSpot</a>, <a href="https://x.com" target="_blank" rel="noreferrer">X</a>, <a href="https://letterboxd.com" target="_blank" rel="noreferrer">Letterboxd</a>, <a href="https://grids.fun" target="_blank" rel="noreferrer">grids.fun</a> y <a href="https://tiermaker.com" target="_blank" rel="noreferrer">TierMaker</a>.</p>
              <small>GeekSphere es un proyecto independiente y no está afiliado a estas plataformas.</small>
            </div>
            <div className="credits-group"><h2>Gracias</h2>
              <p>A Redfire, LineSpartan y Ebisu, por estar pendientes del desarrollo y apoyarme durante el camino.</p>
              <p>Y a las primeras personas que probaron GeekSphere: gracias por dedicarle tiempo, compartir sus impresiones y ayudar a que la aplicación siga mejorando.</p>
            </div>
          </div> : <>
          <section className="legal-summary"><h2>EN RESUMEN</h2><ul>{doc.summary.map(item => <li key={item}>{item}</li>)}</ul><p>Este resumen te ayuda a orientarte. A continuación puedes consultar el documento completo.</p></section>
          {doc.sections.map(([number, title, copy]) => {
            const copyParts = copy.split('[[report]]')
            return <section id={`legal-${number}`} className="legal-section" key={number}><span className="legal-section-number">{number}</span><div><h2>{title}</h2><p>{copyParts.map((part, index) => <span key={index}>{part}{index < copyParts.length - 1 && <Link to="/report">página de denuncias</Link>}</span>)}</p></div></section>
          })}
          </>}
        </article>
      </div>
    </div>
  </div>
}
