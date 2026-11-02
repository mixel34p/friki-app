import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './LegalPage.css'

const documents = {
  terms: {
    path: '/terms', label: 'Términos', eyebrow: 'El acuerdo', title: 'Términos de uso',
    intro: 'Las reglas básicas para usar GeekSphere, compartir tus aficiones y cuidar lo que construimos entre todos.',
    summary: ['Solo pueden crear una cuenta las personas de 16 años o más.', 'Tú conservas tus derechos sobre lo que publicas y nos autorizas a mostrarlo dentro de GeekSphere.', 'Podemos revisar contenido, retirar publicaciones y suspender cuentas que incumplan estas condiciones.'],
    updated: '2 de noviembre de 2026',
    sections: [
      ['01', 'Quién ofrece GeekSphere', 'GeekSphere es un servicio gestionado por Miguel Álvarez, establecido en España y disponible para personas usuarias de todo el mundo, sujeto a las leyes aplicables en cada lugar. Puedes contactar con GeekSphere en miguelelprom@gmail.com. En estos términos, “GeekSphere”, “nosotros” y “nuestro” se refieren a este servicio y a quien lo gestiona.'],
      ['02', 'Edad mínima', 'Para crear una cuenta o utilizar las funciones que requieren registro debes tener al menos 16 años. Durante el onboarding te pedimos tu fecha de nacimiento únicamente para comprobar este requisito y no la guardamos. No intentes falsear tu edad ni usar una cuenta de otra persona.'],
      ['03', 'Tu cuenta', 'Facilita información correcta y mantén seguras tus credenciales. Eres responsable de la actividad realizada desde tu cuenta. No suplantes a otras personas ni compartas tu cuenta para eludir estas condiciones. Si detectas un acceso no autorizado, comunícalo desde [[report]]. Puedes cerrar sesión o solicitar la eliminación de tu cuenta desde los ajustes.'],
      ['04', 'Lo que publicas', 'Conservas los derechos sobre el contenido que creas. Al publicarlo, autorizas a GeekSphere, con una licencia mundial, no exclusiva y gratuita, a alojarlo, reproducirlo, adaptarlo técnicamente y mostrarlo dentro del servicio para ofrecer sus funciones, distribuirlo en los espacios que elijas y mantener la comunidad. Esta licencia termina cuando el contenido se elimina de GeekSphere, salvo copias técnicas temporales o aquello que debamos conservar por obligación legal. No vendemos tu contenido ni lo usamos para fines ajenos al funcionamiento de GeekSphere.'],
      ['05', 'Visibilidad del contenido', 'Algunas partes de GeekSphere, como perfiles, publicaciones, reseñas y listas públicas, pueden ser visibles para otras personas y aparecer en búsquedas o enlaces compartidos. Elige con cuidado qué compartes. Las conversaciones y espacios pueden tener audiencias distintas; comprueba quién puede acceder antes de publicar.'],
      ['06', 'Contenido y derechos de terceros', 'Publica contenido propio o que tengas permiso para compartir. Respeta los derechos de autor, marcas, privacidad y demás derechos de otras personas. Las referencias, imágenes, datos y marcas relacionados con videojuegos y anime pertenecen a sus respectivos titulares; GeekSphere no afirma ser su propietario ni estar afiliado a ellos, salvo que se indique expresamente.'],
      ['07', 'Uso permitido', 'No uses GeekSphere para vulnerar la ley, acosar o amenazar, discriminar, invadir la privacidad, estafar, enviar spam, distribuir software dañino, acceder sin permiso a cuentas o sistemas, manipular interacciones ni recopilar datos de otras personas sin autorización. Las Normas de la comunidad detallan cómo esperamos que convivas y compartas contenido.'],
      ['08', 'Moderación y medidas', 'GeekSphere puede utilizar sistemas automatizados para analizar contenido y decidir si permite enviarlo o publicarlo, o si lo retira. Estos sistemas no suspenden cuentas. Presenta las denuncias desde [[report]]; el equipo de moderación las revisará. El equipo puede limitar la visibilidad o retirar contenido, restringir funciones o suspender una cuenta según la gravedad y repetición del incumplimiento. Si quieres apelar una decisión de moderación, escribe a geekspheresupport@gmail.com.'],
      ['09', 'Eliminar tu cuenta', 'Puedes solicitar la eliminación de tu cuenta desde los ajustes. Al completarse, eliminaremos la cuenta y el contenido asociado, incluidos tus publicaciones, comentarios, listas, mensajes e imágenes, salvo aquello que debamos conservar por obligación legal o para resolver reclamaciones. La eliminación puede tardar el tiempo necesario para propagarse a copias técnicas y sistemas de respaldo.'],
      ['10', 'Servicio gratuito y aportaciones', 'El acceso a GeekSphere será siempre gratuito. Puedes apoyar voluntariamente el mantenimiento del servicio mediante Ko-fi, un servicio externo. La aportación no es necesaria para utilizar GeekSphere y no da acceso a ventajas, funciones ni trato especial. Cualquier pago en Ko-fi se rige también por las condiciones de esa plataforma.'],
      ['11', 'Disponibilidad y cambios', 'Trabajamos para que GeekSphere funcione bien, pero no podemos garantizar que el servicio esté disponible sin interrupciones o errores. Podemos modificar o retirar funciones por motivos técnicos, de seguridad o de funcionamiento. Si un cambio afecta de manera importante a estos términos, publicaremos la versión actualizada aquí y cambiaremos la fecha de revisión.'],
      ['12', 'Ley aplicable y contacto', 'Para consultas sobre estos términos o para apelar una medida de moderación, escribe a geekspheresupport@gmail.com. La ley aplicable y el modo de resolver disputas deben confirmarse antes de publicar la versión definitiva; en todo caso, se respetarán las normas imperativas que protejan a las personas usuarias en su país.']
    ]
  },
  privacy: {
    path: '/privacy', label: 'Privacidad', eyebrow: 'Tus datos', title: 'Política de privacidad',
    intro: 'Qué información utiliza GeekSphere para que puedas tener una cuenta, compartir tus intereses y participar en la comunidad.',
    summary: ['Usamos los datos de tu cuenta, perfil y actividad para prestar las funciones de GeekSphere.', 'Tu fecha de nacimiento se usa para comprobar la edad y no se guarda en tu perfil.', 'Algunos proveedores externos reciben consultas, contenido para traducir o contenido sometido a moderación.', 'Puedes ejercer tus derechos escribiendo a geekspheresupport@gmail.com.'],
    updated: '2 de noviembre de 2026',
    sections: [
      ['01', 'Quién es responsable', 'El responsable del tratamiento es Miguel Álvarez, establecido en España. Para consultas de privacidad o para ejercer tus derechos, escribe a geekspheresupport@gmail.com.'],
      ['02', 'Datos que utilizamos', 'Tratamos los datos de cuenta necesarios para registrarte e iniciar sesión, como tu correo electrónico e identificadores de cuenta; las credenciales se gestionan mediante Supabase Auth. Tu perfil puede incluir nombre de usuario y nombre visible, biografía, avatar, banner, pronombres, ubicación que escribas, enlaces sociales, canción, color y preferencias de juegos y anime. También tratamos tus publicaciones, reseñas, valoraciones, listas, tierlists, comentarios, mensajes en espacios, reacciones, seguimientos, bloqueos y notificaciones.'],
      ['03', 'Comprobación de edad', 'Durante el onboarding introduces tu fecha de nacimiento para comprobar que tienes al menos 16 años. La fecha se conserva temporalmente en el borrador de sesión del navegador mientras completas el onboarding; no se envía al perfil ni se guarda en la base de datos, y el borrador se elimina al terminar el proceso.'],
      ['04', 'Para qué los usamos', 'Usamos los datos para crear y proteger tu cuenta, comprobar el requisito de edad, mostrar tu perfil y el contenido según la visibilidad elegida, habilitar las funciones sociales, generar recomendaciones relacionadas con tus gustos, enviar notificaciones, traducir mensajes cuando lo solicites y prevenir o moderar incumplimientos. Los perfiles y contenidos públicos pueden ser vistos por personas que no tienen cuenta.'],
      ['05', 'Almacenamiento en tu dispositivo', 'GeekSphere utiliza el almacenamiento local del navegador para mantener la sesión iniciada y, si guardas varias cuentas, conservar en ese dispositivo los datos de sesión necesarios para volver a ellas. También utiliza el almacenamiento de sesión para borradores de onboarding y otros formularios temporales. Puedes cerrar sesión, quitar cuentas guardadas desde el menú o borrar los datos de GeekSphere en la configuración del navegador. No encontramos herramientas propias de analítica ni publicidad en la aplicación.'],
      ['06', 'Proveedores y transferencias', 'Supabase presta la autenticación, base de datos, almacenamiento de archivos y funciones de servidor; el proyecto está alojado en Irlanda. Vercel aloja la web; la región concreta de ejecución y el tratamiento de registros deben confirmarse en la configuración del proyecto. Si eliges iniciar sesión con Google, Discord, Twitch o X, esos servicios participan en la autenticación. AniList e IGDB/Twitch proporcionan datos del catálogo; GIPHY recibe las búsquedas de GIF; y MyMemory recibe el texto del mensaje únicamente cuando solicitas traducirlo. OpenAI presta la API externa de moderación descrita más abajo. Sus datos de API no se utilizan para entrenar modelos por defecto y sus registros de supervisión de abuso pueden conservar contenido hasta 30 días. Algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo; el responsable debe informar de las garantías aplicables a esas transferencias.'],
      ['07', 'Bases jurídicas', 'Tratamos los datos necesarios para crear la cuenta y prestar las funciones que solicitas; los datos opcionales del perfil y el contenido se utilizan para mostrar las funciones que eliges. La seguridad, prevención del abuso y moderación se apoyan en el interés legítimo de proteger GeekSphere y a su comunidad. Cuando una finalidad requiera consentimiento, podrás retirarlo sin afectar a los tratamientos anteriores. También podemos conservar o comunicar información cuando una obligación legal lo requiera.'],
      ['08', 'Conservación y eliminación', 'Conservamos los datos de cuenta y el contenido asociado mientras mantengas la cuenta. Si solicitas eliminarla, eliminaremos la cuenta y tu contenido. Conservaremos durante tres semanas los registros de denuncias y moderación, incluso después de eliminar la cuenta. Las copias de seguridad pueden conservar datos eliminados hasta que se sustituyan o expiren; el plazo de esas copias está pendiente de confirmar.'],
      ['09', 'Revisión automatizada', 'OpenAI analiza automáticamente los textos que envías o publicas en GeekSphere, excepto los campos de tu perfil. También puede analizar las imágenes incluidas en publicaciones y los elementos personalizados de listas. El análisis puede impedir que se envíe o publique contenido o retirar una publicación; no suspende cuentas. El sistema recibe el texto o la imagen necesarios para evaluar el contenido. OpenAI no usa datos de la API para entrenar modelos por defecto y puede conservar el contenido en registros de supervisión de abuso hasta 30 días. Las denuncias las revisa el equipo de moderación y puedes apelar decisiones escribiendo a geekspheresupport@gmail.com.'],
      ['10', 'Tus derechos', 'Puedes solicitar acceso, rectificación, supresión, limitación u oposición al tratamiento y, cuando corresponda, portabilidad. Para ejercerlos, escribe a geekspheresupport@gmail.com. También puedes presentar una reclamación ante la autoridad de control competente; en España, la Agencia Española de Protección de Datos (AEPD).'],
      ['11', 'Actualizaciones', 'Actualizaremos esta política cuando cambien los datos, las finalidades o los proveedores utilizados. La fecha de la última revisión aparece al inicio.']
    ]
  },
  community: {
    path: '/community-guidelines', label: 'Normas', eyebrow: 'Convivencia', title: 'Normas de la comunidad',
    intro: 'GeekSphere va de compartir lo que te gusta. Estas normas ayudan a que todo el mundo pueda disfrutarlo a gusto.',
    summary: ['Trata bien a las personas y respeta su privacidad.', 'Marca siempre los spoilers y avisa del contenido sensible.', 'Comparte tus proyectos con moderación y respeta el trabajo ajeno.', 'Las mismas normas valen para publicaciones, reseñas, listas y espacios.'],
    updated: '2 de noviembre de 2026',
    sections: [
      ['01', 'Buen rollo, también en los debates', 'Puedes discrepar sobre un juego, una serie o cualquier tema sin que la conversación se convierta en un ataque. No están permitidos las amenazas, los insultos dirigidos, el acoso repetido ni organizarse para molestar a alguien. Tampoco el contenido que ataque o excluya a personas por quiénes son, ni hacerse pasar por otra persona.'],
      ['02', 'Cuida la privacidad', 'No publiques datos personales de otra persona sin su permiso: por ejemplo, su dirección, teléfono, cuentas privadas o información que permita localizarla. Respeta también la privacidad de las conversaciones y de los espacios.'],
      ['03', 'Spoilers: siempre con aviso', 'Marca como spoiler cualquier revelación importante de la historia, el final o una sorpresa de un juego, anime u otra obra. Hazlo en publicaciones y reseñas; en los chats, avisa claramente antes del spoiler. Si puedes, indica de qué obra es para que cada persona decida si quiere verlo.'],
      ['04', 'Contenido sensible, con cabeza', 'Se permite la violencia moderada y el contenido sexual leve, siempre que no sea explícito y se comparta con contexto. Marca como sensible las publicaciones que puedan impactar; si el espacio no ofrece esa opción, añade una advertencia clara. No se permite el contenido sexual explícito, la violencia gráfica ni el contenido sexual o explotador que involucre a menores.'],
      ['05', 'Comparte tus cosas sin hacer spam', 'Puedes compartir tu arte, proyectos, canales o redes si tiene sentido en la conversación. Evita repetir promociones, llenar espacios de enlaces, engañar a otras personas o manipular reacciones y seguidores. Nada de estafas ni automatización para inundar GeekSphere.'],
      ['06', 'Dale crédito a quien lo merece', 'Comparte contenido propio o que tengas permiso para publicar. Cuando uses el trabajo de otra persona, reconoce su autoría y no borres sus marcas o créditos.'],
      ['07', 'También en los espacios', 'Estas normas se aplican en toda GeekSphere: publicaciones, reseñas, listas, comentarios y chats de espacios. Si un espacio tiene reglas adicionales, síguelas siempre que no contradigan estas normas.'],
      ['08', 'Si algo se tuerce', 'Si ves algo que incumple estas normas, repórtalo desde la [[report]] y cuéntanos qué ha pasado. No hace falta montar una discusión pública ni organizar ataques. Según la gravedad y si se repite, podemos avisar, retirar contenido, limitar funciones o suspender una cuenta. Si no estás de acuerdo con una decisión, puedes pedir que la revisemos escribiendo a geekspheresupport@gmail.com.']
    ]
  }
}

const credits = {
  path: '/credits',
  label: 'Créditos',
  title: 'Créditos',
  intro: 'GeekSphere se inspira en comunidades y productos que hacen bien eso de compartir lo que te gusta. Gracias a quienes crean y mantienen las herramientas que usamos.'
}

const libraryCredits = [
  ['React', 'https://www.npmjs.com/package/react'],
  ['React DOM', 'https://www.npmjs.com/package/react-dom'],
  ['React Router', 'https://www.npmjs.com/package/react-router-dom'],
  ['Supabase JS', 'https://www.npmjs.com/package/@supabase/supabase-js'],
  ['Framer Motion', 'https://www.npmjs.com/package/framer-motion'],
  ['React Icons', 'https://www.npmjs.com/package/react-icons'],
  ['React Markdown', 'https://www.npmjs.com/package/react-markdown'],
  ['remark-gfm', 'https://www.npmjs.com/package/remark-gfm'],
  ['react-twemoji', 'https://www.npmjs.com/package/react-twemoji'],
  ['date-fns', 'https://www.npmjs.com/package/date-fns'],
  ['Dnd Kit', 'https://www.npmjs.com/package/@dnd-kit/core'],
  ['Dnd Kit Sortable', 'https://www.npmjs.com/package/@dnd-kit/sortable'],
  ['Dnd Kit Utilities', 'https://www.npmjs.com/package/@dnd-kit/utilities'],
  ['react-easy-crop', 'https://www.npmjs.com/package/react-easy-crop'],
  ['React Helmet Async', 'https://www.npmjs.com/package/react-helmet-async'],
  ['Groq SDK', 'https://www.npmjs.com/package/groq-sdk'],
  ['Google Generative AI SDK', 'https://www.npmjs.com/package/@google/generative-ai'],
  ['Vite', 'https://www.npmjs.com/package/vite'],
  ['Vite React Plugin', 'https://www.npmjs.com/package/@vitejs/plugin-react'],
  ['ESLint', 'https://www.npmjs.com/package/eslint'],
  ['ESLint JS', 'https://www.npmjs.com/package/@eslint/js'],
  ['ESLint React Hooks Plugin', 'https://www.npmjs.com/package/eslint-plugin-react-hooks'],
  ['ESLint React Refresh Plugin', 'https://www.npmjs.com/package/eslint-plugin-react-refresh'],
  ['TypeScript React Types', 'https://www.npmjs.com/package/@types/react'],
  ['TypeScript React DOM Types', 'https://www.npmjs.com/package/@types/react-dom'],
  ['globals', 'https://www.npmjs.com/package/globals']
]

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
