const ADMIN_PASSWORD = "huellas2026";

let modeloIA = null;
let embeddingsEncontrados = JSON.parse(localStorage.getItem('embeddingsEncontrados')) || [];

async function cargarIA(){
  console.log('🧠 Cargando IA...');
  modeloIA = await mobilenet.load({version:2, alpha:1.0});
  console.log('✅ IA lista');
  document.getElementById('cargando').innerText = '🧠 IA cargada - Lista para buscar';
}
cargarIA();

function base64ToImg(base64){
  return new Promise(res=>{
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = ()=>res(img);
    img.src = base64;
  });
}

async function getEmbedding(base64){
  if(!modeloIA) return null;
  const img = await base64ToImg(base64);
  const tensor = tf.browser.fromPixels(img).resizeBilinear([224,224]).expandDims(0).toFloat().div(255);
  const embedding = modeloIA.infer(tensor, 'conv_preds');
  const data = await embedding.data();
  tensor.dispose(); embedding.dispose();
  return Array.from(data); 
}

function similitudCoseno(a,b){
  if(!a||!b||a.length!==b.length) return 0;
  let dot=0, normA=0, normB=0;
  for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; normA+=a[i]*a[i]; normB+=b[i]*b[i]; }
  return dot / (Math.sqrt(normA)*Math.sqrt(normB));
}

let myId = localStorage.getItem('myId');
if(!myId){ myId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); localStorage.setItem('myId', myId); }
let isAdmin = localStorage.getItem('isAdmin') === 'true';

const EJEMPLOS = [];
let perrosEncontrados = JSON.parse(localStorage.getItem('perros')) || EJEMPLOS;
let perrosPerdidos = JSON.parse(localStorage.getItem('perrosPerdidos')) || [];

perrosEncontrados = perrosEncontrados.map((p,i)=> ({id: p.id || Date.now()+i, ownerId: p.ownerId || 'system',...p}));
perrosPerdidos = perrosPerdidos.map((p,i)=> ({id: p.id || Date.now()+i+10000, ownerId: p.ownerId || myId,...p}));

function guardar(){ localStorage.setItem('perros', JSON.stringify(perrosEncontrados)); localStorage.setItem('perrosPerdidos', JSON.stringify(perrosPerdidos)); actualizarContador(); }
function guardarPerdidos(){ localStorage.setItem('perrosPerdidos', JSON.stringify(perrosPerdidos)); actualizarContador(); }

function actualizarContador(){
  document.getElementById('contador').innerText = perrosEncontrados.length + ' encontrados / ' + perrosPerdidos.length + ' perdidos';
  const btn = document.getElementById('btn-admin');
  if(btn){
    if(isAdmin){ btn.innerText = '🔓 Admin ON'; btn.classList.add('active'); }
    else { btn.innerText = '🔐 Admin'; btn.classList.remove('active'); }
  }
}
actualizarContador();

function toggleAdmin(){
  if(isAdmin){
    isAdmin = false;
    localStorage.setItem('isAdmin','false');
    toast('Modo Admin desactivado');
    actualizarContador(); mostrarTodos(); mostrarPerdidos();
    return;
  }
  const pass = prompt('Contraseña de administrador:');
  if(pass === ADMIN_PASSWORD){
    isAdmin = true;
    localStorage.setItem('isAdmin','true');
    toast('✅ Modo Admin activado');
    actualizarContador(); mostrarTodos(); mostrarPerdidos();
  } else if(pass!== null){ alert('Contraseña incorrecta'); }
}

function cambiarTab(nombre){
  document.getElementById('vista-buscar').classList.add('hidden');
  document.getElementById('vista-reportar').classList.add('hidden');
  document.getElementById('vista-reportar-perdido').classList.add('hidden');
  document.getElementById('vista-todos').classList.add('hidden');
  document.getElementById('vista-perdidos').classList.add('hidden');
  document.getElementById('vista-'+nombre).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+nombre).classList.add('active');
  if(nombre==='todos') mostrarTodos();
  if(nombre==='perdidos') mostrarPerdidos();
}

let fotoPerdidoBase64 = '', fotoEncontradoBase64 = '', fotoPerdidoPubBase64 = '';
function configurarSubida(zonaId, fileId, previewId, callback){
  const zona = document.getElementById(zonaId);
  const file = document.getElementById(fileId);
  const preview = document.getElementById(previewId);
  if(!zona||!file||!preview) return;
  zona.onclick = () => file.click();
  zona.ondragover = e => { e.preventDefault(); zona.style.borderColor='#FF6B35'; };
  zona.ondrop = e => { e.preventDefault(); file.files = e.dataTransfer.files; leer(); };
  file.onchange = leer;
  function leer(){
    const f = file.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = e => { callback(e.target.result); preview.innerHTML = `<img src="${e.target.result}">`; };
    reader.readAsDataURL(f);
  }
}
configurarSubida('zona-lost','file-lost','preview-lost', d=>fotoPerdidoBase64=d);
configurarSubida('zona-found','file-found','preview-found', d=>fotoEncontradoBase64=d);
configurarSubida('zona-lost-pub','file-lost-pub','preview-lost-pub', d=>fotoPerdidoPubBase64=d);

async function publicarEncontrado(){
  const desc = document.getElementById('desc-found').value;
  const raza = document.getElementById('raza-found').value;
  const color = document.getElementById('color-found').value;
  const zona = document.getElementById('zona-found-input').value;
  const contacto = document.getElementById('contact-found').value;
  if(!fotoEncontradoBase64 ||!desc){ alert('Foto y descripción obligatorias'); return; }

  toast('🧠 Analizando imagen con IA...');
  const emb = await getEmbedding(fotoEncontradoBase64);

  const nuevo = { id: Date.now(), raza, color, zona, desc, contacto, img: fotoEncontradoBase64, ownerId: myId };
  perrosEncontrados.push(nuevo);
  embeddingsEncontrados.push(emb);
  guardar();
  localStorage.setItem('embeddingsEncontrados', JSON.stringify(embeddingsEncontrados));
  toast('¡Publicado con huella de IA!');
  cambiarTab('todos');
}

function publicarPerdido(){
  const desc = document.getElementById('desc-lost-pub').value;
  const raza = document.getElementById('raza-lost-pub').value;
  const color = document.getElementById('color-lost-pub').value;
  const zona = document.getElementById('zona-lost-pub-input').value;
  const contacto = document.getElementById('contact-lost-pub').value;
  if(!fotoPerdidoPubBase64 ||!desc){ alert('Foto y descripción obligatorias'); return; }
  const nuevo = { id: Date.now(), raza, color, zona, desc, contacto, img: fotoPerdidoPubBase64, ownerId: myId };
  perrosPerdidos.push(nuevo);
  guardarPerdidos();
  toast('¡Publicado en Perdidos!');
  cambiarTab('perdidos');
}

async function buscarPerdido(){
  const desc = document.getElementById('desc-lost').value.toLowerCase().trim();
  const raza = document.getElementById('raza-lost').value.toLowerCase().trim();
  const color = document.getElementById('color-lost').value.toLowerCase().trim();
  const zona = document.getElementById('zona-lost-input').value.toLowerCase().trim();

  if(!fotoPerdidoBase64){ alert('Sube una foto de tu perdido para que la IA lo analice'); return; }
  if(!modeloIA){ alert('La IA aún está cargando, espera 5 segundos'); return; }

  document.getElementById('cargando').classList.remove('hidden');
  document.getElementById('cargando').innerText = '🧠 IA analizando tu foto...';

  const embBusqueda = await getEmbedding(fotoPerdidoBase64);

  let conScore = perrosEncontrados.map((p,i)=>{
    let score = 0;
    const simImg = embeddingsEncontrados[i]? similitudCoseno(embBusqueda, embeddingsEncontrados[i]) : 0;
    const scoreImg = Math.round(simImg * 70); 

    let scoreTexto = 0;
    if(raza && p.raza.toLowerCase().includes(raza)) scoreTexto += 10;
    if(color && p.color.toLowerCase().includes(color)) scoreTexto += 5;
    if(zona && p.zona.toLowerCase().includes(zona)) scoreTexto += 5;
    if(desc){
      let palabras = desc.split(' ').filter(w=>w.length>3);
      let comunes = palabras.filter(w=> p.desc.toLowerCase().includes(w)).length;
      scoreTexto += Math.min(10, comunes * 2);
    }

    score = scoreImg + scoreTexto;

    if(fotoPerdidoBase64 === p.img) score = 100;

    return {...p, score: Math.min(100, Math.max(10, Math.round(score)))};
  }).sort((a,b)=>b.score-a.score).filter(p=>p.score >= 25);

  document.getElementById('cargando').classList.add('hidden');
  const cont = document.getElementById('resultados');
  const sinRes = document.getElementById('sin-resultados');

  if(conScore.length===0){
    sinRes.classList.remove('hidden');
    sinRes.innerHTML = `❌ Ningún perro supera el 25% de similitud con IA.`;
    cont.innerHTML = '';
    return;
  }
  sinRes.classList.add('hidden');
  cont.innerHTML = '';
  conScore.forEach(p=>{ cont.innerHTML += crearCard(p, true); });
}

function crearCard(p, conScore){
  const esMio = p.ownerId === myId;
  const claseMio = esMio? 'card-mio' : '';
  const badgeMio = esMio? '<span class="mio-badge">MI PUBLICACIÓN</span>' : '';
  let botones = '';
  if(esMio){
    botones = `<button onclick="alert('Contactar: ${p.contacto}')" style="width:100%; margin-top:8px; border:1px solid #ddd; background:white; padding:6px; border-radius:8px; font-size:12px;">💬 Contactar</button>
      <button onclick="borrarMiPublicacion(${p.id})" class="btn-borrar-mio">✅ Ya lo entregué - Borrar mi publicación</button>`;
  } else if(isAdmin){
    botones = `<div style="display:flex; gap:6px; margin-top:8px"><button onclick="alert('Contactar: ${p.contacto}')" style="flex:1; border:1px solid #ddd; background:white; padding:6px; border-radius:8px; font-size:12px;">💬 Contactar</button><button onclick="borrarComoAdmin(${p.id})" class="btn-borrar-admin">🗑️ Admin</button></div>`;
  } else {
    botones = `<button onclick="alert('Contactar: ${p.contacto}')" style="width:100%; margin-top:8px; border:1px solid #ddd; background:white; padding:6px; border-radius:8px; font-size:12px;">💬 Contactar</button>`;
  }
  return `<div class="card ${claseMio}"><img src="${p.img}"><div class="card-body"><div style="display:flex; justify-content:space-between; flex-wrap:wrap"><b style="font-size:13px">${p.raza} • ${p.color}</b>${badgeMio}${conScore?`<span class="badge">${p.score}% MATCH</span>`:''}</div><p style="font-size:11px; color:gray">📍 ${p.zona}</p>${conScore?`<div class="barra"><div style="width:${p.score}%"></div></div>`:''}<p style="font-size:12px; margin-top:6px">${p.desc}</p>${botones}</div></div>`;
}

function crearCardPerdido(p){
  const esMio = p.ownerId === myId;
  const claseMio = esMio? 'card-mio' : '';
  const badgeMio = esMio? '<span class="mio-badge">MI PERRO PERDIDO</span>' : '';
  let botones = '';
  if(esMio){
    botones = `<button onclick="borrarMiPerdido(${p.id})" class="btn-borrar-mio" style="background:#d32f2f">✅ Ya lo encontré - Borrar</button>`;
  } else if(isAdmin){
    botones = `<div style="display:flex; gap:6px; margin-top:8px"><button onclick="alert('Contactar: ${p.contacto}')" style="flex:1; border:1px solid #ddd; background:white; padding:6px; border-radius:8px; font-size:12px;">💬 Contactar dueño</button><button onclick="borrarPerdidoAdmin(${p.id})" class="btn-borrar-admin">🗑️ Admin</button></div>`;
  } else {
    botones = `<button onclick="alert('Contactar: ${p.contacto}')" style="width:100%; margin-top:8px; border:1px solid #ddd; background:white; padding:6px; border-radius:8px; font-size:12px;">💬 Contactar dueño - Yo lo vi</button>`;
  }
  return `<div class="card ${claseMio}"><img src="${p.img}"><div class="card-body"><div style="display:flex; justify-content:space-between"><b style="font-size:13px">${p.raza} • ${p.color}</b>${badgeMio}</div><p style="font-size:11px; color:gray">📍 Perdido en ${p.zona}</p><p style="font-size:12px; margin-top:6px">${p.desc}</p>${botones}</div></div>`;
}

function mostrarTodos(){
  const cont = document.getElementById('grid-todos');
  cont.innerHTML = '';
  perrosEncontrados.slice().reverse().forEach(p=>{ cont.innerHTML += crearCard(p, false); });
}
function mostrarPerdidos(){
  const cont = document.getElementById('grid-perdidos');
  cont.innerHTML = '';
  if(perrosPerdidos.length===0){ cont.innerHTML = '<div class="vacio">Aún no hay perros perdidos.<br><small>Usa ➕ Perdido para publicar</small></div>'; return; }
  perrosPerdidos.slice().reverse().forEach(p=>{ cont.innerHTML += crearCardPerdido(p); });
}

function borrarMiPublicacion(id){
  if(!confirm('¿Ya entregaste este perro? Se borrará tu publicación.')) return;
  perrosEncontrados = perrosEncontrados.filter(p => p.id!== id);
  guardar(); mostrarTodos(); toast('Publicación borrada ✅');
}
function borrarComoAdmin(id){
  if(!isAdmin){ alert('Solo admin'); return; }
  if(!confirm('ADMIN: ¿Borrar publicación indebida?')) return;
  perrosEncontrados = perrosEncontrados.filter(p => p.id!== id);
  guardar(); mostrarTodos(); toast('Borrada por Admin 🛡️');
}
function borrarMiPerdido(id){
  if(!confirm('¿Ya encontraste a tu perro? Se borrará tu publicación.')) return;
  perrosPerdidos = perrosPerdidos.filter(p => p.id!== id);
  guardarPerdidos(); mostrarPerdidos(); toast('¡Qué alegría! Perdido borrado ✅');
}
function borrarPerdidoAdmin(id){
  if(!isAdmin){ alert('Solo admin'); return; }
  if(!confirm('ADMIN: ¿Borrar este perdido indebido?')) return;
  perrosPerdidos = perrosPerdidos.filter(p => p.id!== id);
  guardarPerdidos(); mostrarPerdidos(); toast('Perdido indebido borrado 🛡️');
}
function borrarPerro(id){ borrarComoAdmin(id); }

function toast(msg){
  const t = document.getElementById('toast');
  t.innerText = msg; t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'), 3000);
}

function toggleTheme(){
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  // vibración suave en celular
  if(navigator.vibrate) navigator.vibrate(30);
}
// Cargar preferencia guardada
(function(){
  if(localStorage.getItem('darkMode') === 'true'){
    document.body.classList.add('dark');
  }
})();