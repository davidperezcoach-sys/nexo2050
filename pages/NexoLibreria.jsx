// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  NEXO LIBRERÍA ULTRA 2050 — CAPÍTULOS PROGRESIVOS + DESCARGA PDF           ║
// ║  Lector capítulo a capítulo · Libro completo descargable · Crear nuevo     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NexoLibro, StudentProfile, NexoWorld } from "@/api/entities";
import { User } from "@/api/entities";

const LEO = {
  1: { nombre:"Lumo",  emoji:"🌱", color:"#4ade80", grad:"linear-gradient(135deg,#4ade80,#22c55e)", age:"5-6 años"  },
  2: { nombre:"Zara",  emoji:"🧭", color:"#60a5fa", grad:"linear-gradient(135deg,#60a5fa,#3b82f6)", age:"7-8 años"  },
  3: { nombre:"Kai",   emoji:"🕵️", color:"#a78bfa", grad:"linear-gradient(135deg,#a78bfa,#7c3aed)", age:"9-10 años" },
  4: { nombre:"Nova",  emoji:"⚗️", color:"#fbbf24", grad:"linear-gradient(135deg,#fbbf24,#f59e0b)", age:"11-12 años"},
  5: { nombre:"Axel",  emoji:"💻", color:"#f87171", grad:"linear-gradient(135deg,#f87171,#ef4444)", age:"13-14 años"},
  6: { nombre:"Lyra",  emoji:"🔭", color:"#22d3ee", grad:"linear-gradient(135deg,#22d3ee,#06b6d4)", age:"15-16 años"},
  7: { nombre:"Orion", emoji:"👑", color:"#fb923c", grad:"linear-gradient(135deg,#fb923c,#f97316)", age:"17-18 años"},
};

const MATERIAS_LIST = [
  { id:"todos",       emoji:"✨", label:"Todo"     },
  { id:"lectura",     emoji:"📖", label:"Lectura"  },
  { id:"matematicas", emoji:"📐", label:"Mates"    },
  { id:"ingles",      emoji:"🌍", label:"Inglés"   },
  { id:"ciencias",    emoji:"🔬", label:"Ciencias" },
  { id:"economia",    emoji:"💰", label:"Economía" },
  { id:"coding",      emoji:"💻", label:"Coding"   },
  { id:"lengua",      emoji:"✍️", label:"Lengua"   },
];

const ETAPAS = [1,2,3,4,5,6,7];

async function invoke(fn, body) {
  const { base44 } = await import("@/api/base44Client");
  const r = await base44.functions.invoke(fn, body);
  return r?.data || r;
}

// ─── PARTÍCULAS ───────────────────────────────────────────────────────────────
function Particulas({ color }) {
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {Array.from({length:15}).map((_,i)=>(
        <motion.div key={i}
          style={{
            position:"absolute",
            width: 2+Math.random()*3,
            height: 2+Math.random()*3,
            borderRadius:"50%",
            background: color,
            left: `${Math.random()*100}%`,
            top: `${Math.random()*100}%`,
            opacity: 0.08+Math.random()*0.12,
          }}
          animate={{ y:[-20,20,-20], x:[-10,10,-10], opacity:[0.05,0.18,0.05] }}
          transition={{ duration:5+Math.random()*6, repeat:Infinity, ease:"easeInOut", delay:Math.random()*4 }}
        />
      ))}
    </div>
  );
}

// ─── PARSEAR CAPÍTULOS DEL CONTENT ───────────────────────────────────────────
function parsearCapitulos(content) {
  if (!content) return [];

  // Buscar bloques CAPÍTULO con el patrón real del backend:
  // ══════...══
CAPÍTULO N: TÍTULO
══════...══

texto
  const regex = /[═]{10,}\nCAPÍTULO (\d+): ([^\n]+)\n[═]{10,}\n\n/g;
  const matches = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    matches.push({ num: parseInt(m[1]), titulo: m[2].trim(), pos: m.index, end: regex.lastIndex });
  }

  if (matches.length === 0) {
    // Formato antiguo o sin separadores — todo es un capítulo
    return [{ numero: 1, titulo: "Capítulo 1", texto: content }];
  }

  const caps = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end   = i + 1 < matches.length ? matches[i+1].pos : content.length;
    caps.push({
      numero: matches[i].num,
      titulo: matches[i].titulo,
      texto:  content.slice(start, end).trim(),
    });
  }
  return caps;
}

// ─── DESCARGAR COMO TXT (PDF requiere librería externa) ──────────────────────
function descargarLibro(libro) {
  const texto = `${libro.title}\n${"=".repeat(60)}\nAutor: ${libro.author}\nGénero: ${libro.genre} | Materia: ${libro.materia}\n\n${libro.synopsis}\n\n${"=".repeat(60)}\n\n${libro.content}`;
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${libro.title.replace(/[^a-zA-Z0-9\s]/g,"").trim()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// LECTOR INMERSIVO — LEE → TEST → DESBLOQUEA SIGUIENTE CAPÍTULO
// ══════════════════════════════════════════════════════════════════════════════
function LectorInmersivo({ libro: libroInicial, personaje, onCerrar, onXPGanado, onCrearNuevo }) {
  const [libro,          setLibro]          = useState(libroInicial);
  const [capitulos,      setCapitulos]      = useState([]);
  const [capActual,      setCapActual]      = useState(0);
  const [fase,           setFase]           = useState("leer"); // "leer" | "test" | "completado"
  const [generandoCap,   setGenerandoCap]   = useState(false);
  const [libroCompleto,  setLibroCompleto]  = useState(false);
  const [xpGanado,       setXpGanado]       = useState(false);
  const [respuestas,     setRespuestas]     = useState({});
  const [mostrarResp,    setMostrarResp]    = useState(false);
  const [xpCapitulo,     setXpCapitulo]     = useState(0);
  const [audioUrl,       setAudioUrl]       = useState(null);
  const [generandoAudio, setGenerandoAudio] = useState(false);
  const [toast,          setToast]          = useState(null);
  const [resumenAcum,    setResumenAcum]    = useState("");
  const scrollRef = useRef(null);

  const showToast = (msg,col="#4ade80")=>{ setToast({msg,col}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{
    const caps = parsearCapitulos(libro.content);
    setCapitulos(caps);
    setFase("leer");
    setRespuestas({});
    setMostrarResp(false);
  }, [libro.id]);

  const capVisible        = capitulos[capActual] || null;
  const totalCapsGuardados = capitulos.length;
  const etapaConfig       = {1:10,2:12,3:15,4:20,5:25,6:32,7:40};
  const totalCapsEsperados = etapaConfig[libro.stage] || 10;
  const esUltimoCap       = capActual === totalCapsGuardados - 1;
  const libroYaCompleto   = totalCapsGuardados >= totalCapsEsperados || libroCompleto;

  // XP por capítulo = xp_reward dividido entre total caps
  const xpPorCap = Math.max(10, Math.round((libro.xp_reward || 50) / totalCapsEsperados));

  // Preguntas — se generan 1 por capítulo desde las 5 generales del libro
  const todasPreguntas = Array.isArray(libro.comprehension_questions) ? libro.comprehension_questions : [];
  // Rotar preguntas por capítulo (1 pregunta por cap, cíclica)
  const preguntaDelCap = todasPreguntas.length > 0
    ? [todasPreguntas[capActual % todasPreguntas.length]]
    : [];

  // ── Terminar la lectura del capítulo → ir al mini-test
  const terminarLectura = () => {
    setRespuestas({});
    setMostrarResp(false);
    setFase("test");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Verificar respuesta y ganar XP
  const verificarRespuesta = () => {
    setMostrarResp(true);
    setXpCapitulo(xpPorCap);
    onXPGanado?.(xpPorCap);
  };

  // ── Desbloquear siguiente capítulo
  const desbloquearSiguiente = async () => {
    setRespuestas({});
    setMostrarResp(false);

    // Si ya hay capítulos guardados adelante, ir al siguiente
    if (capActual < totalCapsGuardados - 1) {
      setCapActual(c => c + 1);
      setFase("leer");
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Si no hay más capítulos guardados → generar el siguiente
    if (!libroYaCompleto) {
      setGenerandoCap(true);
      showToast(`✍️ LEO escribiendo capítulo ${totalCapsGuardados + 1}...`, personaje.color);
      try {
        const data = await invoke("adminLibrary", {
          action:           "generar_capitulo",
          titulo_libro:     libro.title,
          genero:           libro.genre,
          materia:          libro.materia,
          etapa_id:         libro.stage,
          num_capitulo:     totalCapsGuardados + 1,
          total_caps:       totalCapsEsperados,
          resumen_anterior: resumenAcum,
        });

        if (data?.ok && data?.texto_capitulo) {
          const nuevoCap = {
            numero: totalCapsGuardados + 1,
            titulo: data.titulo_capitulo || `Capítulo ${totalCapsGuardados + 1}`,
            texto:  data.texto_capitulo,
          };
          const sep = `\n\n${"═".repeat(50)}\nCAPÍTULO ${nuevoCap.numero}: ${nuevoCap.titulo.toUpperCase()}\n${"═".repeat(50)}\n\n`;
          const nuevoContent = (libro.content || "") + sep + nuevoCap.texto;

          await NexoLibro.update(libro.id, { content: nuevoContent });

          const libroActualizado = { ...libro, content: nuevoContent };
          setLibro(libroActualizado);
          const capsActualizados = [...capitulos, nuevoCap];
          setCapitulos(capsActualizados);
          setCapActual(capsActualizados.length - 1);

          if (data.resumen) {
            const partes = resumenAcum.split(" | ").filter(Boolean);
            setResumenAcum([...partes.slice(-2), `Cap.${nuevoCap.numero}: ${data.resumen}`].join(" | ") + " | ");
          }

          const esCompleto = (totalCapsGuardados + 1) >= totalCapsEsperados;
          if (esCompleto) {
            setLibroCompleto(true);
            showToast("🎉 ¡Libro completo! ¡Increíble!", "#fbbf24");
          } else {
            showToast(`✅ ¡Capítulo ${nuevoCap.numero} desbloqueado!`, "#4ade80");
          }

          setFase("leer");
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          showToast("⚠️ Error generando capítulo", "#f87171");
        }
      } catch(e) { showToast("⚠️ " + e.message, "#f87171"); }
      setGenerandoCap(false);
    } else {
      // Libro completo — mostrar pantalla final
      setFase("completado");
    }
  };

  const generarAudio = async () => {
    if (!capVisible?.texto) return;
    setGenerandoAudio(true);
    showToast("🎙️ Generando voz de LEO...", personaje.color);
    try {
      const data = await invoke("adminLibrary", {
        action: "generar_audio",
        texto_libro: capVisible.texto.substring(0, 4000),
        etapa_id: libro.stage,
      });
      if (data?.audio_url) { setAudioUrl(data.audio_url); showToast("✅ Audio listo", "#4ade80"); }
      else showToast("⚠️ Error de audio", "#f87171");
    } catch(e) { showToast("⚠️ " + e.message, "#f87171"); }
    setGenerandoAudio(false);
  };

  const pct = Math.round(((capActual + (fase==="test"||fase==="completado"?1:0.5)) / Math.max(totalCapsEsperados,1)) * 100);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      ref={scrollRef}
      style={{position:"fixed",inset:0,background:"radial-gradient(ellipse at top,#0a0520 0%,#030508 100%)",zIndex:1000,overflowY:"auto",fontFamily:"Inter,sans-serif"}}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{y:-60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-60,opacity:0}}
            style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.col,color:"white",padding:"10px 24px",borderRadius:24,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header sticky */}
      <div style={{position:"sticky",top:0,background:"rgba(3,5,8,.95)",backdropFilter:"blur(24px)",borderBottom:`1px solid ${personaje.color}20`,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,zIndex:100}}>
        <motion.button onClick={onCerrar} whileTap={{scale:.9}}
          style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",color:"white",cursor:"pointer",fontSize:18,flexShrink:0}}>←</motion.button>

        <div style={{flex:1,overflow:"hidden"}}>
          <div style={{fontSize:14,fontWeight:800,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{libro.cover_emoji} {libro.title}</div>
          <div style={{fontSize:11,color:personaje.color,fontWeight:600}}>
            Cap. {capActual+1}/{libroYaCompleto?totalCapsGuardados:totalCapsEsperados}
            {" · "}{fase==="leer"?"📖 Leyendo":fase==="test"?"🧠 Test":"🎉 Completado"}
          </div>
        </div>

        {/* Barra progreso */}
        <div style={{width:80,height:6,background:"rgba(255,255,255,.08)",borderRadius:4,overflow:"hidden"}}>
          <motion.div animate={{width:`${pct}%`}}
            style={{height:"100%",background:personaje.grad,borderRadius:4,transition:"width .4s"}}/>
        </div>

        {/* Audio solo en fase leer */}
        {fase==="leer" && (
          <motion.button onClick={generarAudio} disabled={generandoAudio} whileTap={{scale:.9}}
            style={{width:36,height:36,borderRadius:12,background:`${personaje.color}15`,border:`1px solid ${personaje.color}30`,color:personaje.color,cursor:"pointer",fontSize:16,flexShrink:0}}>
            {generandoAudio?"⏳":"🎧"}
          </motion.button>
        )}
      </div>

      <div style={{maxWidth:740,margin:"0 auto",padding:"28px 20px 80px"}}>

        {/* ════════ FASE: LEER ════════ */}
        {fase==="leer" && capVisible && (
          <motion.div key={`leer-${capActual}`} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}>

            {/* Cabecera capítulo */}
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{display:"inline-block",background:`${personaje.color}15`,border:`1px solid ${personaje.color}30`,borderRadius:20,padding:"5px 16px",fontSize:11,color:personaje.color,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>
                Capítulo {capVisible.numero} · {libro.cover_emoji}
              </div>
              <div style={{fontSize:20,fontWeight:900,color:"white",lineHeight:1.3}}>{capVisible.titulo}</div>
            </div>

            {/* Vocab solo en cap 1 */}
            {capActual===0 && Array.isArray(libro.vocabulary_words) && libro.vocabulary_words.length>0 && (
              <div style={{background:`${personaje.color}08`,border:`1px solid ${personaje.color}22`,borderRadius:16,padding:14,marginBottom:18}}>
                <div style={{fontSize:11,color:personaje.color,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>📌 Vocabulario clave</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {libro.vocabulary_words.map((w,i)=>(
                    <span key={i} style={{background:`${personaje.color}15`,border:`1px solid ${personaje.color}30`,borderRadius:16,padding:"3px 10px",fontSize:12,color:"rgba(255,255,255,.7)"}}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Audio player si disponible */}
            {audioUrl && (
              <div style={{marginBottom:16}}>
                <audio controls src={audioUrl} style={{width:"100%",borderRadius:10}}/>
              </div>
            )}

            {/* Texto */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:20,padding:"22px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                <span style={{fontSize:15}}>{personaje.emoji}</span>
                <span style={{fontSize:12,color:personaje.color,fontWeight:700}}>{personaje.nombre} te cuenta...</span>
              </div>
              {capVisible.texto.split("\n").filter(p=>p.trim()).map((p,i)=>(
                <motion.p key={i} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.008}}
                  style={{fontSize:15,lineHeight:1.9,color:"rgba(255,255,255,.82)",marginBottom:14}}>
                  {p}
                </motion.p>
              ))}
            </div>

            {/* CTA: Terminar lectura → ir al test */}
            <motion.button onClick={terminarLectura}
              whileTap={{scale:.97}} whileHover={{scale:1.02}}
              style={{width:"100%",padding:"16px 0",borderRadius:18,border:"none",background:personaje.grad,color:"white",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 28px ${personaje.color}44`}}>
              ✅ Terminé de leer · Hacer el test →
            </motion.button>

            {/* Ir a cap anterior */}
            {capActual > 0 && (
              <motion.button onClick={()=>{setCapActual(c=>c-1);setFase("leer");scrollRef.current?.scrollTo({top:0,behavior:"smooth"});}}
                whileTap={{scale:.97}}
                style={{width:"100%",marginTop:10,padding:"12px 0",borderRadius:16,border:`1px solid rgba(255,255,255,.08)`,background:"transparent",color:"rgba(255,255,255,.3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                ← Capítulo anterior
              </motion.button>
            )}
          </motion.div>
        )}

        {/* ════════ FASE: TEST ════════ */}
        {fase==="test" && (
          <motion.div key={`test-${capActual}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>

            {/* Header test */}
            <div style={{textAlign:"center",marginBottom:28}}>
              <motion.div animate={{scale:[1,1.1,1]}} transition={{duration:1.5,repeat:Infinity}}
                style={{fontSize:52,marginBottom:10}}>🧠</motion.div>
              <div style={{fontSize:18,fontWeight:900,color:"white",marginBottom:4}}>
                Test del Capítulo {capActual+1}
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>
                Responde para desbloquear el siguiente capítulo
              </div>
              {/* Badge XP */}
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`${personaje.color}15`,border:`1px solid ${personaje.color}30`,borderRadius:20,padding:"6px 16px",marginTop:10}}>
                <span style={{fontSize:14}}>⭐</span>
                <span style={{fontSize:13,fontWeight:800,color:personaje.color}}>+{xpPorCap} XP al completar</span>
              </div>
            </div>

            {preguntaDelCap.length === 0 ? (
              /* Sin preguntas — desbloquear directamente */
              <div style={{textAlign:"center",padding:30}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:20}}>No hay preguntas para este capítulo</div>
                <motion.button onClick={desbloquearSiguiente} disabled={generandoCap}
                  whileTap={{scale:.97}} whileHover={{scale:1.02}}
                  style={{padding:"14px 32px",borderRadius:18,border:"none",background:generandoCap?"rgba(255,255,255,.08)":personaje.grad,color:"white",fontSize:14,fontWeight:800,cursor:generandoCap?"not-allowed":"pointer",boxShadow:`0 6px 20px ${personaje.color}44`}}>
                  {generandoCap?"✍️ LEO escribiendo...":libroYaCompleto&&esUltimoCap?"🎉 ¡Libro completado!":"✨ Siguiente capítulo →"}
                </motion.button>
              </div>
            ) : (
              <>
                {preguntaDelCap.map((q,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${personaje.color}20`,borderRadius:18,padding:20,marginBottom:16}}>
                    <div style={{fontSize:15,fontWeight:700,color:"white",marginBottom:14,lineHeight:1.5}}>
                      💬 {q.question}
                    </div>
                    <textarea
                      value={respuestas[i]||""}
                      onChange={e=>setRespuestas(r=>({...r,[i]:e.target.value}))}
                      placeholder="Escribe tu respuesta aquí..."
                      rows={4}
                      disabled={mostrarResp}
                      style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${personaje.color}33`,borderRadius:14,padding:"12px 16px",color:"white",fontSize:14,resize:"none",outline:"none",fontFamily:"inherit",opacity:mostrarResp?.7:1}}
                    />
                    {mostrarResp && (
                      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                        style={{marginTop:12,padding:14,background:`${personaje.color}10`,border:`1px solid ${personaje.color}30`,borderRadius:12}}>
                        <div style={{fontSize:11,color:personaje.color,fontWeight:800,marginBottom:4}}>💡 RESPUESTA GUÍA</div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,.75)",lineHeight:1.6}}>{q.answer}</div>
                      </motion.div>
                    )}
                  </div>
                ))}

                {!mostrarResp ? (
                  <motion.button
                    onClick={verificarRespuesta}
                    disabled={(respuestas[0]||"").trim().length < 5}
                    whileTap={{scale:.97}} whileHover={{scale:1.02}}
                    style={{width:"100%",padding:"15px 0",borderRadius:18,border:"none",
                      background:(respuestas[0]||"").trim().length>=5?personaje.grad:"rgba(255,255,255,.06)",
                      color:"white",fontSize:14,fontWeight:800,
                      cursor:(respuestas[0]||"").trim().length>=5?"pointer":"not-allowed",
                      boxShadow:(respuestas[0]||"").trim().length>=5?`0 6px 20px ${personaje.color}44`:"none"}}>
                    ✅ Ver respuesta · Ganar +{xpPorCap} XP
                  </motion.button>
                ) : (
                  <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
                    style={{textAlign:"center",marginTop:8}}>
                    {/* XP ganado */}
                    <motion.div
                      initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",bounce:.5}}
                      style={{display:"inline-block",background:`linear-gradient(135deg,#fbbf24,#f59e0b)`,borderRadius:20,padding:"8px 22px",fontSize:15,fontWeight:900,color:"white",marginBottom:16,boxShadow:"0 4px 20px rgba(251,191,36,.4)"}}>
                      🎉 +{xpPorCap} XP ganados
                    </motion.div>

                    <motion.button onClick={desbloquearSiguiente} disabled={generandoCap}
                      whileTap={{scale:.97}} whileHover={{scale:1.02}}
                      style={{width:"100%",padding:"15px 0",borderRadius:18,border:"none",
                        background:generandoCap?"rgba(255,255,255,.08)":
                          libroYaCompleto&&esUltimoCap?"linear-gradient(135deg,#fbbf24,#f59e0b)":personaje.grad,
                        color:"white",fontSize:14,fontWeight:800,
                        cursor:generandoCap?"not-allowed":"pointer",
                        boxShadow:generandoCap?"none":libroYaCompleto&&esUltimoCap?"0 6px 20px rgba(251,191,36,.4)":`0 6px 20px ${personaje.color}44`}}>
                      {generandoCap?"✍️ LEO escribiendo el siguiente...":
                        libroYaCompleto&&esUltimoCap?"🏆 ¡Ver mi libro completo!":
                        "🔓 Desbloquear Capítulo " + (capActual+2) + " →"}
                    </motion.button>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ════════ FASE: COMPLETADO ════════ */}
        {fase==="completado" && (
          <motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}}
            style={{textAlign:"center",paddingTop:40}}>
            <motion.div animate={{rotate:[0,10,-10,0],scale:[1,1.2,1]}} transition={{duration:1,repeat:3}}
              style={{fontSize:72,marginBottom:16}}>🏆</motion.div>
            <div style={{fontSize:22,fontWeight:900,color:"white",marginBottom:6}}>
              ¡Libro completado!
            </div>
            <div style={{fontSize:14,color:personaje.color,fontWeight:700,marginBottom:4}}>
              {libro.title}
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:28}}>
              {totalCapsGuardados} capítulos · {Math.round((libro.content||"").split(/\s+/).length/250)} páginas · ¡Eres increíble!
            </div>

            {/* Stats */}
            <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:28,flexWrap:"wrap"}}>
              {[
                {icon:"⭐",val:`+${libro.xp_reward} XP`,label:"Total ganado"},
                {icon:"📖",val:`${totalCapsGuardados}`,label:"Capítulos"},
                {icon:"🧠",val:`${totalCapsGuardados}`,label:"Tests pasados"},
              ].map((s,i)=>(
                <div key={i} style={{background:`${personaje.color}10`,border:`1px solid ${personaje.color}25`,borderRadius:16,padding:"14px 20px",minWidth:90}}>
                  <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:18,fontWeight:900,color:personaje.color}}>{s.val}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <motion.button onClick={()=>descargarLibro(libro)}
                whileTap={{scale:.97}} whileHover={{scale:1.02}}
                style={{padding:"13px 22px",borderRadius:16,border:`1px solid ${personaje.color}44`,background:"transparent",color:personaje.color,fontSize:13,fontWeight:800,cursor:"pointer"}}>
                📥 Descargar libro
              </motion.button>
              <motion.button onClick={onCrearNuevo}
                whileTap={{scale:.97}} whileHover={{scale:1.02}}
                style={{padding:"13px 22px",borderRadius:16,border:"none",background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"white",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 6px 20px rgba(251,191,36,.4)"}}>
                ✨ Crear nuevo libro
              </motion.button>
            </div>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function NexoLibreria() {
  const [usuario,      setUsuario]      = useState(null);
  const [nexosMundo,   setNexosMundo]   = useState(null);
  const [etapa,        setEtapa]        = useState(3);
  const [libros,       setLibros]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [generando,    setGenerando]    = useState(false);
  const [materia,      setMateria]      = useState("todos");
  const [busqueda,     setBusqueda]     = useState("");
  const [libroAbierto, setLibroAbierto] = useState(null);
  const [toast,        setToast]        = useState(null);

  const personaje = LEO[etapa] || LEO[3];
  const showToast = (msg,col)=>{ setToast({msg,col}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{
    (async()=>{
      try {
        const u = await User.me();
        setUsuario(u);
        const ps = await StudentProfile.filter({user_id:u.id});
        if(ps[0]) setEtapa(ps[0].stage||3);
        const ms = await NexoWorld.filter({student_id:u.id});
        if(ms[0]) setNexosMundo(ms[0]);
      } catch {}
      setLoading(false);
    })();
  },[]);

  useEffect(()=>{ if(!loading) cargar(etapa); },[etapa,loading]);

  const cargar = async (e) => {
    setLoading(true);
    try {
      let lista = await NexoLibro.filter({stage:Number(e),status:"activo"});
      if(lista.length===0){
        const todos = await NexoLibro.list();
        lista = todos.filter(l=>Number(l.stage)===Number(e));
      }
      setLibros(lista);
    } catch { setLibros([]); }
    setLoading(false);
  };

  const generarNuevoLibro = async () => {
    setGenerando(true);
    showToast("✍️ LEO está creando el primer capítulo...", personaje.color);
    try {
      const data = await invoke("adminLibrary",{
        action:"generar_libros", etapa_id:etapa,
        materia:materia==="todos"?"lectura":materia, cantidad:1,
      });
      if(data?.total_generados>0 && data?.libros?.[0]){
        showToast("✅ Capítulo 1 listo — ¡a leer!", "#4ade80");
        await cargar(etapa);
        // Abrir el libro recién creado
        const libroNuevo = await NexoLibro.get(data.libros[0].id);
        if(libroNuevo) setLibroAbierto(libroNuevo);
      } else {
        showToast("⚠️ Error generando — inténtalo de nuevo", "#f87171");
      }
    } catch(e){ showToast("⚠️ "+e.message,"#f87171"); }
    setGenerando(false);
  };

  const onXPGanado = async (xp) => {
    showToast(`🎉 +${xp} XP y Nexos ganados`,"#4ade80");
    if(nexosMundo){
      try {
        await NexoWorld.update(nexosMundo.id,{
          nexos:(nexosMundo.nexos||0)+xp,
          nexos_totales_ganados:(nexosMundo.nexos_totales_ganados||0)+xp,
        });
        setNexosMundo(m=>({...m,nexos:(m.nexos||0)+xp}));
      } catch {}
    }
  };

  const onCrearNuevo = () => {
    setLibroAbierto(null);
    generarNuevoLibro();
  };

  const librosFiltrados = libros
    .filter(l=> materia==="todos" || l.materia===materia)
    .filter(l=> !busqueda || l.title?.toLowerCase().includes(busqueda.toLowerCase()) || l.synopsis?.toLowerCase().includes(busqueda.toLowerCase()));

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',sans-serif;}
    ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:4px;}
    textarea:focus{outline:none;}
  `;

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at top left,#0d0520 0%,#04080f 50%,#000 100%)",color:"white",fontFamily:"Inter,sans-serif",position:"relative"}}>
        <Particulas color={personaje.color}/>

        <AnimatePresence>
          {libroAbierto && (
            <LectorInmersivo
              libro={libroAbierto}
              personaje={personaje}
              onCerrar={()=>{ setLibroAbierto(null); cargar(etapa); }}
              onXPGanado={onXPGanado}
              onCrearNuevo={onCrearNuevo}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && !libroAbierto && (
            <motion.div initial={{y:-60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-60,opacity:0}}
              style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.col||personaje.color,color:"white",padding:"10px 24px",borderRadius:24,fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* HEADER */}
        <div style={{background:"rgba(0,0,0,.5)",backdropFilter:"blur(24px)",borderBottom:`1px solid ${personaje.color}18`,padding:"18px 24px",position:"sticky",top:0,zIndex:50}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:160}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <motion.span animate={{rotate:[0,5,-5,0]}} transition={{duration:3,repeat:Infinity}} style={{fontSize:26}}>📚</motion.span>
                <div>
                  <div style={{fontSize:17,fontWeight:900,background:personaje.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Nexo Librería</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{personaje.emoji} {personaje.nombre} · {libros.length} libros</div>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {ETAPAS.map(n=>(
                <motion.button key={n} onClick={()=>setEtapa(n)} whileTap={{scale:.9}}
                  style={{width:36,height:36,borderRadius:12,border:"none",cursor:"pointer",fontSize:15,background:etapa===n?LEO[n].grad:"rgba(255,255,255,.05)",color:"white",boxShadow:etapa===n?`0 4px 16px ${LEO[n].color}44`:"none",fontWeight:800}}>
                  {LEO[n].emoji}
                </motion.button>
              ))}
            </div>

            {nexosMundo && (
              <div style={{background:`${personaje.color}15`,border:`1px solid ${personaje.color}33`,borderRadius:20,padding:"7px 16px",fontSize:13,fontWeight:800,color:personaje.color}}>
                ⚡ {nexosMundo.nexos||0} Nexos
              </div>
            )}

            <motion.button onClick={generarNuevoLibro} disabled={generando}
              whileTap={{scale:.97}} whileHover={{scale:1.02}}
              style={{padding:"10px 20px",borderRadius:16,border:"none",background:generando?"rgba(255,255,255,.06)":personaje.grad,color:"white",fontSize:13,fontWeight:800,cursor:generando?"not-allowed":"pointer",boxShadow:generando?"none":`0 4px 20px ${personaje.color}44`,opacity:generando?.7:1}}>
              {generando?"⏳ Creando...":"✨ Nuevo libro"}
            </motion.button>
          </div>
        </div>

        <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 24px"}}>

          {/* Banner etapa */}
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
            style={{background:`linear-gradient(135deg,${personaje.color}10,${personaje.color}04)`,border:`1px solid ${personaje.color}25`,borderRadius:18,padding:"14px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <motion.span animate={{scale:[1,1.1,1]}} transition={{duration:2,repeat:Infinity}} style={{fontSize:32}}>{personaje.emoji}</motion.span>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"white"}}>Etapa {etapa} — {personaje.nombre} · {personaje.age}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>
                {libros.length>0 ? `${libros.length} libro${libros.length!==1?"s":""} · Pulsa un libro para continuar leyendo o crea uno nuevo` : "Crea tu primer libro con el botón ✨ Nuevo libro"}
              </div>
            </div>
          </motion.div>

          {/* Filtros */}
          <div style={{position:"relative",marginBottom:14}}>
            <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:.4}}>🔍</div>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar libros..."
              style={{width:"100%",padding:"11px 14px 11px 38px",borderRadius:14,background:"rgba(255,255,255,.04)",border:`1px solid ${personaje.color}22`,color:"white",fontSize:13,outline:"none"}}/>
          </div>

          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:24}}>
            {MATERIAS_LIST.map(m=>(
              <motion.button key={m.id} onClick={()=>setMateria(m.id)} whileTap={{scale:.9}}
                style={{padding:"6px 14px",borderRadius:18,border:"none",background:materia===m.id?personaje.grad:"rgba(255,255,255,.05)",color:materia===m.id?"white":"rgba(255,255,255,.4)",fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:materia===m.id?`0 4px 16px ${personaje.color}33`:"none"}}>
                {m.emoji} {m.label}
              </motion.button>
            ))}
          </div>

          {/* GRID LIBROS */}
          {loading ? (
            <div style={{textAlign:"center",padding:60}}>
              <motion.div animate={{rotate:360}} transition={{duration:1.2,repeat:Infinity,ease:"linear"}} style={{width:32,height:32,border:`3px solid ${personaje.color}33`,borderTopColor:personaje.color,borderRadius:"50%",margin:"0 auto 12px"}}/>
              <div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Cargando biblioteca...</div>
            </div>
          ) : librosFiltrados.length === 0 ? (
            <div style={{textAlign:"center",padding:80}}>
              <div style={{fontSize:56,marginBottom:16}}>📭</div>
              <div style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:8}}>No hay libros aquí todavía</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.25)",marginBottom:24}}>Pulsa ✨ Nuevo libro y LEO escribirá uno para ti</div>
              <motion.button onClick={generarNuevoLibro} disabled={generando}
                whileTap={{scale:.97}} whileHover={{scale:1.02}}
                style={{padding:"13px 28px",borderRadius:18,border:"none",background:personaje.grad,color:"white",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 28px ${personaje.color}44`}}>
                {generando?"⏳ Creando primer capítulo...":"✨ Crear primer libro"}
              </motion.button>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:18}}>
              {librosFiltrados.map(libro=>{
                const caps = parsearCapitulos(libro.content);
                const etapaConfig = {1:10,2:12,3:15,4:20,5:25,6:32,7:40};
                const totalEsp = etapaConfig[libro.stage]||10;
                const pct = Math.round((caps.length/totalEsp)*100);
                const completo = caps.length >= totalEsp;
                return (
                  <motion.div key={libro.id}
                    onClick={()=>setLibroAbierto(libro)}
                    whileHover={{y:-4,boxShadow:`0 16px 48px ${personaje.color}25`}}
                    whileTap={{scale:.98}}
                    style={{background:"rgba(255,255,255,.03)",border:`1px solid ${completo?personaje.color+"44":"rgba(255,255,255,.07)"}`,borderRadius:20,padding:20,cursor:"pointer",position:"relative",overflow:"hidden"}}>

                    {completo && (
                      <div style={{position:"absolute",top:12,right:12,background:personaje.grad,borderRadius:10,padding:"3px 10px",fontSize:10,fontWeight:800,color:"white"}}>
                        ✅ COMPLETO
                      </div>
                    )}

                    <div style={{fontSize:48,marginBottom:12,textAlign:"center"}}>{libro.cover_emoji}</div>
                    <div style={{fontSize:15,fontWeight:800,color:"white",marginBottom:4,lineHeight:1.3}}>{libro.title}</div>
                    <div style={{fontSize:12,color:personaje.color,marginBottom:8,fontWeight:600}}>✍️ {libro.author}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:14,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                      {libro.synopsis}
                    </div>

                    {/* Progreso capítulos */}
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,.35)",marginBottom:5}}>
                        <span>Capítulos leídos</span>
                        <span>{caps.length}/{totalEsp}</span>
                      </div>
                      <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:completo?personaje.grad:`linear-gradient(90deg,${personaje.color}88,${personaje.color}44)`,borderRadius:2,transition:"width .3s"}}/>
                      </div>
                    </div>

                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <span style={{background:"rgba(255,255,255,.06)",borderRadius:10,padding:"3px 9px",fontSize:11,color:"rgba(255,255,255,.45)"}}>⏱ {libro.reading_time_minutes}min</span>
                      <span style={{background:"rgba(255,255,255,.06)",borderRadius:10,padding:"3px 9px",fontSize:11,color:"rgba(255,255,255,.45)"}}>⭐ +{libro.xp_reward}XP</span>
                      <span style={{background:"rgba(255,255,255,.06)",borderRadius:10,padding:"3px 9px",fontSize:11,color:"rgba(255,255,255,.45)"}}>📂 {libro.genre}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
