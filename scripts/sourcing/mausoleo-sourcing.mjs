#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Mausoleo de Twitter — pipeline de sourcing (Fase 1 spike)
//
// Valida la cadena Wikidata → Wikiquote → Commons sobre un puñado de figuras
// semilla y emite public/data/agora/personajes.json con timeline HÍBRIDO:
//   · citas reales (Wikiquote, verbatim)  → verificacion "real-sourced"/"real-unsourced"
//   · glosa IA (curada a mano aquí)        → verificacion "ai-gloss"
//
// El etiquetado es ESTRUCTURAL: cada post lleva `verificacion`; la glosa nunca
// se confunde con una cita. Solo figuras históricas / de dominio público.
//
// Datos puros (CC0/CC-BY-SA): fechas, ocupación, obras, retrato, citas reales.
// Glosa: redactada a mano (este script es offline; el runtime solo renderiza).
//
// Uso:  node scripts/sourcing/mausoleo-sourcing.mjs
// ─────────────────────────────────────────────────────────────────────────

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../public/data/agora/personajes.json");

const UA = "KOINOS-mausoleo-sourcing/0.1 (civic prototype; contact: local)";

// ── Semillas: QID Wikidata + página Wikiquote ES + glosa curada ──────────────
// Glosa = paráfrasis contextual en 3ª persona, nunca cita inventada en 1ª.
const SEEDS = [
  {
    id: "perez-galdos",
    qid: "Q189869",
    wikiquote: "Benito Pérez Galdós",
    ambito: "canario",
    corriente: "Realismo",
    glosa: [
      "Cronista de un país entero: los «Episodios Nacionales» convirtieron la historia de España en relato cotidiano, calle a calle.",
      "Grancanario de nacimiento, madrileño de oficio: miró a la nación desde la distancia atlántica de quien llegó de fuera."
    ]
  },
  {
    id: "viera-y-clavijo",
    qid: "Q326385",
    wikiquote: "José de Viera y Clavijo",
    ambito: "canario",
    corriente: "Ilustración",
    glosa: [
      "Polímata ilustrado: su «Historia de Canarias» fue el primer intento de pensar el archipiélago como objeto de estudio, no como margen.",
      "Naturalista, historiador y clérigo: encarnó la Ilustración en una periferia que rara vez aparecía en los mapas del saber."
    ]
  },
  {
    id: "marie-curie",
    qid: "Q7186",
    wikiquote: "Marie Curie",
    ambito: "universal",
    corriente: "Ciencia moderna",
    glosa: [
      "Dos Nobel, dos disciplinas: abrió la física de la radiactividad y sostuvo que el conocimiento no debía cercarse con patentes.",
      "Pionera en un mundo que no le reservaba sitio: trabajó la ciencia como bien común mucho antes de que fuera consigna."
    ]
  },
  {
    id: "martin-luther-king",
    qid: "Q8027",
    wikiquote: "Martin Luther King",
    ambito: "universal",
    corriente: "Derechos civiles",
    glosa: [
      "Predicó que la justicia se construye con desobediencia no violenta: el conflicto sin odio como motor del cambio.",
      "Su «sueño» no era utopía evasiva sino exigencia concreta: igualdad ante la ley, aquí y ahora."
    ]
  },

  // ── Canarios (sin Wikiquote ES ⇒ solo glosa contextual) ──────────────────────
  {
    id: "nicolas-estevanez",
    qid: "Q4892306",
    wikiquote: null,
    ambito: "canario",
    corriente: "Republicanismo federal",
    glosa: [
      "Militar que dimitió antes que disparar contra el pueblo: en 1873 prefirió la coherencia al sillón de ministro de Guerra.",
      "Tinerfeño de versos y barricadas: encarnó el republicanismo federal que soñó otra España desde la distancia atlántica."
    ]
  },
  {
    id: "tomas-morales",
    qid: "Q9088280",
    wikiquote: null,
    ambito: "canario",
    corriente: "Modernismo",
    glosa: [
      "Médico de oficio, poeta del océano: cantó al Atlántico como nadie, convirtiendo el mar de las islas en materia épica.",
      "Modernista insular: su «Oda al Atlántico» dio voz lírica a un archipiélago acostumbrado al silencio en los cánones peninsulares."
    ]
  },
  {
    id: "leon-y-castillo",
    qid: "Q4890616",
    wikiquote: null,
    ambito: "canario",
    corriente: "Liberalismo / regeneracionismo",
    glosa: [
      "Diplomático y constructor de puertos: ligó el destino de Gran Canaria al Puerto de La Luz y a las rutas del mundo.",
      "Liberal de la Restauración: movió los hilos de Madrid sin olvidar nunca la isla que lo había enviado."
    ]
  },
  {
    id: "secundino-delgado",
    qid: "Q9075457",
    wikiquote: null,
    ambito: "canario",
    corriente: "Nacionalismo canario",
    glosa: [
      "Padre del nacionalismo canario: desde el exilio y la cárcel imaginó unas islas dueñas de su propio relato.",
      "Periodista combativo: fundó periódicos para que Canarias se pensara como sujeto, no como apéndice de nadie."
    ]
  },
  {
    id: "nestor-de-la-torre",
    qid: "Q940975",
    wikiquote: null,
    ambito: "canario",
    corriente: "Simbolismo / Tipismo",
    glosa: [
      "Pintor del Atlántico mítico: sus «Poemas del Mar» y «de la Tierra» elevaron el paisaje canario a símbolo.",
      "Inventor del Tipismo: diseñó una identidad visual para las islas —del traje al edificio— como gesto cultural deliberado."
    ],
    imagenes: [
      { file: "Bajamar (Poema del Mar).jpg", texto: "«Bajamar», del ciclo Poema del Mar (1913–1924). El Atlántico vuelto mito simbolista." },
      { file: "Pleamar (Poema del Mar).jpg", texto: "«Pleamar», del Poema del Mar. La marea alta como alegoría decorativa y oceánica." },
      { file: "Noche (Poema del Mar).jpg", texto: "«Noche», del Poema del Mar. El océano nocturno entre el símbolo y el ornamento." }
    ]
  },
  {
    id: "cesar-manrique",
    qid: "Q581285",
    wikiquote: null,
    ambito: "canario",
    corriente: "Arte y ecología",
    glosa: [
      "Artista que hizo de Lanzarote su lienzo: fundió arte y naturaleza para defender la isla del cemento.",
      "Ecologista antes de que la palabra mandara: predicó que el desarrollo sin paisaje es ruina, y lo demostró obra a obra."
    ],
    imagenes: [
      { file: "Jameos del Agua - Lanzarote -01.jpg", texto: "Jameos del Agua: convirtió un tubo volcánico en obra de arte total, su idea de habitar el paisaje." },
      { file: "Mirador del Río - Lanzarote - 01.jpg", texto: "Mirador del Río: arquitectura mimetizada en el risco. Ver sin que se vea la mano que construye." },
      { file: "Jardín de cactus pano.jpg", texto: "Jardín de Cactus: una cantera reconvertida en jardín, su última gran intervención en Lanzarote." }
    ]
  },
  {
    id: "mercedes-pinto",
    qid: "Q6010925",
    wikiquote: null,
    ambito: "canario",
    corriente: "Feminismo / vanguardia",
    glosa: [
      "Escritora que pagó el exilio por hablar claro: su conferencia «El divorcio como medida higiénica» le costó España.",
      "Feminista pionera del Atlántico: llevó por América la causa de la mujer y la libertad afectiva cuando casi nadie osaba."
    ]
  },
  {
    id: "saulo-toron",
    qid: "Q7427382",
    wikiquote: null,
    ambito: "canario",
    corriente: "Posmodernismo",
    glosa: [
      "Poeta de lo humilde: hizo lírica de lo cotidiano cuando la grandilocuencia mandaba en los versos.",
      "Tercer nombre del modernismo grancanario, junto a Tomás Morales y Alonso Quesada: la voz íntima y menor del archipiélago."
    ]
  },
  {
    id: "josefina-de-la-torre",
    qid: "Q5936686",
    wikiquote: null,
    ambito: "canario",
    corriente: "Generación del 27",
    glosa: [
      "La voz canaria del 27: poeta, soprano y actriz, una de las pocas mujeres que la antología canónica casi borró.",
      "Polifacética por talento y por necesidad: cantó, actuó y escribió cuando a una mujer se le pedía elegir una sola vida."
    ]
  },
  {
    id: "blas-cabrera",
    qid: "Q3327470",
    wikiquote: null,
    ambito: "canario",
    corriente: "Física moderna",
    glosa: [
      "Físico del magnetismo: lanzaroteño que se sentó con Einstein y Curie en los Congresos Solvay.",
      "La ciencia española que el exilio truncó: dirigió la física nacional antes de que la guerra lo empujara fuera."
    ]
  },
  {
    id: "agustin-millares-carlo",
    qid: "Q5660767",
    wikiquote: null,
    ambito: "canario",
    corriente: "Humanismo / filología",
    glosa: [
      "Paleógrafo que enseñó a leer el pasado: descifró la letra antigua para que la historia no quedara muda.",
      "Humanista grancanario en el exilio americano: bibliógrafo incansable, levantó catálogos donde otros solo veían polvo."
    ]
  },

  // ── Universales (con Wikiquote ES ⇒ cita real + glosa) ───────────────────────
  {
    id: "hannah-arendt",
    qid: "Q60025",
    wikiquote: "Hannah Arendt",
    ambito: "universal",
    corriente: "Teoría política",
    glosa: [
      "Pensó el mal como banalidad, no como monstruo: la obediencia sin pensamiento bastó para sostener el horror.",
      "Defensora de la esfera pública: la política como el espacio donde los humanos aparecen y actúan juntos, no como mera administración."
    ]
  },
  {
    id: "simone-weil",
    qid: "Q157309",
    wikiquote: "Simone Weil",
    ambito: "universal",
    corriente: "Filosofía social / mística",
    glosa: [
      "Filósofa que entró a la fábrica para entender la opresión desde dentro, no desde la teoría.",
      "La atención como forma de justicia: pensó que mirar de verdad a quien sufre es ya un acto moral."
    ]
  },
  {
    id: "rosa-luxemburgo",
    qid: "Q7231",
    wikiquote: "Rosa Luxemburgo",
    ambito: "universal",
    corriente: "Marxismo",
    glosa: [
      "Marxista heterodoxa: defendió que la libertad lo es siempre del que piensa distinto, también dentro de la revolución.",
      "Crítica del dogma y del capital a la vez: pagó con la vida su apuesta por una democracia de los consejos."
    ]
  },
  {
    id: "george-orwell",
    qid: "Q3335",
    wikiquote: "George Orwell",
    ambito: "universal",
    corriente: "Socialismo democrático",
    glosa: [
      "Escribió contra el totalitarismo de cualquier signo: vio cómo el lenguaje degradado prepara la mentira política.",
      "Socialista desengañado de los aparatos: defendió la decencia común y la prosa clara como formas de resistencia."
    ]
  },
  {
    id: "vaclav-havel",
    qid: "Q36233",
    wikiquote: "Václav Havel",
    ambito: "universal",
    corriente: "Disidencia / democracia",
    glosa: [
      "Dramaturgo que acabó de presidente: lideró una revolución «de terciopelo» sin disparar un tiro.",
      "Teórico del «poder de los sin poder»: vivir en la verdad como grieta que resquebraja la mentira del régimen."
    ]
  },

  // ── Españoles (con Wikiquote ES ⇒ cita real + glosa). Núcleo de quotes verbatim. ──
  {
    id: "miguel-de-unamuno",
    qid: "Q185085",
    wikiquote: "Miguel de Unamuno",
    ambito: "universal",
    corriente: "Generación del 98",
    glosa: [
      "Filósofo del «sentimiento trágico de la vida»: hizo de la contradicción entre razón y fe su materia de pensamiento.",
      "Rector de Salamanca que plantó cara al fascismo: encarnó la conciencia incómoda de la España del 98."
    ]
  },
  {
    id: "antonio-machado",
    qid: "Q243771",
    wikiquote: "Antonio Machado",
    ambito: "universal",
    corriente: "Generación del 98",
    glosa: [
      "Poeta de la palabra desnuda: cantó los campos de Castilla y la España que bosteza entre dos reinos.",
      "El compromiso hecho verso: murió en el exilio, fiel a una República que entendía como decencia común."
    ]
  },
  {
    id: "federico-garcia-lorca",
    qid: "Q41408",
    wikiquote: "Federico García Lorca",
    ambito: "universal",
    corriente: "Generación del 27",
    glosa: [
      "Poeta y dramaturgo del duende: unió vanguardia y raíz popular como nadie en su generación.",
      "Voz de los marginados —gitanos, mujeres, deseo— fusilado en 1936: su muerte volvió símbolo su obra."
    ]
  },
  {
    id: "maria-zambrano",
    qid: "Q235134",
    wikiquote: "María Zambrano",
    ambito: "universal",
    corriente: "Razón poética",
    glosa: [
      "Discípula de Ortega que fue más allá del maestro: forjó la «razón poética» como forma de conocer.",
      "Pensadora del exilio: hizo del destierro una categoría filosófica, no solo una herida biográfica."
    ]
  },
  {
    id: "ortega-y-gasset",
    qid: "Q153020",
    wikiquote: "José Ortega y Gasset",
    ambito: "universal",
    corriente: "Raciovitalismo",
    glosa: [
      "Filósofo del «yo y mi circunstancia»: quiso poner a España en hora con la Europa de las ideas.",
      "Ensayista de masas y minorías: pensó la modernidad como tarea, no como destino dado."
    ]
  },
  {
    id: "rosalia-de-castro",
    qid: "Q464264",
    wikiquote: "Rosalía de Castro",
    ambito: "universal",
    corriente: "Rexurdimento / Romanticismo",
    glosa: [
      "Voz del Rexurdimento gallego: devolvió dignidad literaria a una lengua arrinconada.",
      "Poeta de la saudade y la emigración: cantó el dolor callado de un pueblo que se marchaba."
    ]
  },
  {
    id: "concepcion-arenal",
    qid: "Q671852",
    wikiquote: "Concepción Arenal",
    ambito: "universal",
    corriente: "Reformismo social / feminismo",
    glosa: [
      "Pionera del reformismo social: visitó cárceles y hospicios para pensar la pobreza desde dentro.",
      "«La mujer del porvenir»: defendió la educación femenina cuando se le negaba hasta la entrada a las aulas."
    ]
  },
  {
    id: "clara-campoamor",
    qid: "Q3321142",
    wikiquote: "Clara Campoamor",
    ambito: "universal",
    corriente: "Feminismo / sufragismo",
    glosa: [
      "Conquistó el voto femenino en 1931: defendió el sufragio universal contra su propio partido.",
      "Abogada y diputada: pagó con el ostracismo su coherencia con la igualdad que predicaba."
    ]
  },
  {
    id: "emilia-pardo-bazan",
    qid: "Q275929",
    wikiquote: "Emilia Pardo Bazán",
    ambito: "universal",
    corriente: "Naturalismo",
    glosa: [
      "Introdujo el naturalismo en España: novelista y crítica que peleó su sitio en un canon de hombres.",
      "Condesa y feminista incómoda: reclamó para la mujer el derecho al saber y a la cátedra."
    ]
  },
  {
    id: "gustavo-adolfo-becquer",
    qid: "Q203715",
    wikiquote: "Gustavo Adolfo Bécquer",
    ambito: "universal",
    corriente: "Romanticismo",
    glosa: [
      "Romántico tardío e intimista: sus «Rimas» y «Leyendas» hicieron de la melancolía un arte.",
      "Poeta de lo etéreo: murió joven y pobre, y la posteridad lo volvió clásico."
    ]
  },
  {
    id: "mariano-jose-de-larra",
    qid: "Q298773",
    wikiquote: "Mariano José de Larra",
    ambito: "universal",
    corriente: "Romanticismo / costumbrismo",
    glosa: [
      "Periodista mordaz del romanticismo: su prosa diseccionó la España atrasada de su tiempo.",
      "«Escribir en Madrid es llorar»: el costumbrismo crítico como denuncia, hasta su trágico final a los 27."
    ]
  },
  {
    id: "francisco-de-quevedo",
    qid: "Q201315",
    wikiquote: "Francisco de Quevedo",
    ambito: "universal",
    corriente: "Conceptismo (Siglo de Oro)",
    glosa: [
      "Maestro del conceptismo: afiló el ingenio del Siglo de Oro entre la sátira feroz y la metafísica.",
      "Poeta de amor y de muerte: «polvo seré, mas polvo enamorado», cumbre del barroco español."
    ]
  },
  {
    id: "miguel-de-cervantes",
    qid: "Q5682",
    wikiquote: "Miguel de Cervantes",
    ambito: "universal",
    corriente: "Siglo de Oro",
    glosa: [
      "Padre de la novela moderna: con el «Quijote» inventó un modo de mirar el mundo entre la burla y la ternura.",
      "Soldado, cautivo y escritor tardío: su obra nació de una vida de fracasos transformados en literatura."
    ]
  },
  {
    id: "teresa-de-jesus",
    qid: "Q174880",
    wikiquote: "Teresa de Jesús",
    ambito: "universal",
    corriente: "Mística (Siglo de Oro)",
    glosa: [
      "Mística y reformadora: fundó conventos y escribió la experiencia interior con prosa sin igual.",
      "Doctora de la Iglesia: unió arrobo espiritual y pies en la tierra —«entre los pucheros anda Dios»."
    ]
  },

  // ── España (intelectuales y artistas trascendidos, con Wikiquote ES) ─────────
  {
    id: "ramon-y-cajal",
    qid: "Q150526",
    wikiquote: "Santiago Ramón y Cajal",
    ambito: "universal",
    corriente: "Neurociencia",
    glosa: [
      "Padre de la neurociencia moderna: dibujó la neurona como unidad y ganó el Nobel desde un laboratorio modesto.",
      "Defendió que el talento se forja con disciplina —«todo hombre puede ser, si se lo propone, escultor de su propio cerebro»."
    ]
  },
  {
    id: "gregorio-maranon",
    qid: "Q708559",
    wikiquote: "Gregorio Marañón",
    ambito: "universal",
    corriente: "Ensayo / medicina humanista",
    glosa: [
      "Médico y ensayista liberal: entendió la enfermedad como hecho social y la biografía como método de conocimiento.",
      "Símbolo del intelectual del 14: defendió la duda y la tolerancia frente a los dogmatismos de su tiempo."
    ]
  },
  {
    id: "manuel-azana",
    qid: "Q203708",
    wikiquote: "Manuel Azaña",
    ambito: "universal",
    corriente: "Republicanismo / reforma liberal",
    glosa: [
      "Presidente de la República y prosista afilado: quiso modernizar España con educación, laicidad y ley.",
      "Su «paz, piedad y perdón» de 1938 quedó como uno de los grandes discursos civiles de la lengua."
    ]
  },
  {
    id: "menendez-pelayo",
    qid: "Q716799",
    wikiquote: "Marcelino Menéndez Pelayo",
    ambito: "universal",
    corriente: "Historia de las ideas",
    glosa: [
      "Erudito monumental: cartografió siglos de pensamiento y letras hispánicas con una memoria casi inabarcable.",
      "Polemista conservador, fundó la historia intelectual española como disciplina, para bien y para discusión."
    ]
  },
  {
    id: "menendez-pidal",
    qid: "Q381953",
    wikiquote: "Ramón Menéndez Pidal",
    ambito: "universal",
    corriente: "Filología / Medievalismo",
    glosa: [
      "Filólogo que reconstruyó el romancero y el Cid: leyó la lengua como memoria viva de un pueblo.",
      "Maestro de generaciones, hizo del rigor documental una escuela que aún define los estudios hispánicos."
    ]
  },
  {
    id: "pio-baroja",
    qid: "Q220980",
    wikiquote: "Pío Baroja",
    ambito: "universal",
    corriente: "Generación del 98",
    glosa: [
      "Novelista de la acción y el desencanto: retrató aventureros, vagabundos y rebeldes con prosa seca y honesta.",
      "Escéptico irreductible, desconfió de todas las iglesias y partidos —su única fe fue la libertad del individuo."
    ]
  },
  {
    id: "valle-inclan",
    qid: "Q311001",
    wikiquote: "Ramón María del Valle-Inclán",
    ambito: "universal",
    corriente: "Modernismo / Esperpento",
    glosa: [
      "Inventó el esperpento: deformar la realidad en espejo cóncavo para mostrar la tragedia grotesca de España.",
      "Dandi y provocador, llevó el teatro y la novela a una vanguardia que aún parece adelantada a su siglo."
    ]
  },
  {
    id: "blasco-ibanez",
    qid: "Q219646",
    wikiquote: "Vicente Blasco Ibáñez",
    ambito: "universal",
    corriente: "Naturalismo / Republicanismo",
    glosa: [
      "Novelista y agitador republicano: llevó la huerta valenciana y la guerra a un público mundial.",
      "Best-seller traducido y llevado a Hollywood, unió literatura social y compromiso político militante."
    ]
  },
  {
    id: "camilo-jose-cela",
    qid: "Q132589",
    wikiquote: "Camilo José Cela",
    ambito: "universal",
    corriente: "Tremendismo",
    glosa: [
      "Nobel de literatura: con «La colmena» y «La familia de Pascual Duarte» retrató la España áspera de posguerra.",
      "Provocador profesional, hizo del lenguaje crudo y la ironía una marca tan célebre como discutida."
    ]
  },
  {
    id: "miguel-hernandez",
    qid: "Q47480",
    wikiquote: "Miguel Hernández",
    ambito: "universal",
    corriente: "Generación del 36",
    glosa: [
      "Pastor y poeta: del campo de Orihuela a la trinchera, cantó el amor, la guerra y la muerte con fuerza desnuda.",
      "Murió en una cárcel franquista a los 31 —su «Nanas de la cebolla» son herida y ternura a la vez."
    ]
  },
  {
    id: "rafael-alberti",
    qid: "Q118936",
    wikiquote: "Rafael Alberti",
    ambito: "universal",
    corriente: "Generación del 27",
    glosa: [
      "Poeta del 27 y del exilio: del «Marinero en tierra» al compromiso comunista, no separó verso y política.",
      "Vivió medio siglo fuera de España y volvió como memoria viva de una generación arrasada."
    ]
  },
  {
    id: "luis-cernuda",
    qid: "Q439578",
    wikiquote: "Luis Cernuda",
    ambito: "universal",
    corriente: "Generación del 27",
    glosa: [
      "El más íntimo del 27: «La realidad y el deseo» hizo de la distancia entre anhelo y mundo su gran tema.",
      "Homosexual y exiliado, escribió la soledad con una sinceridad que adelantó la poesía que vino después."
    ]
  },
  {
    id: "jorge-guillen",
    qid: "Q59837",
    wikiquote: "Jorge Guillén",
    ambito: "universal",
    corriente: "Generación del 27 / Poesía pura",
    glosa: [
      "Poeta de la plenitud: «Cántico» celebra el puro existir de las cosas con precisión casi geométrica.",
      "Maestro de la poesía pura, buscó la palabra exacta que hace del mundo un orden gozoso."
    ]
  },
  {
    id: "vicente-aleixandre",
    qid: "Q134644",
    wikiquote: "Vicente Aleixandre",
    ambito: "universal",
    corriente: "Generación del 27 / Surrealismo",
    glosa: [
      "Nobel del 27: su poesía surrealista fundió el cuerpo, la tierra y el cosmos en un solo impulso amoroso.",
      "Desde su casa madrileña fue puente entre generaciones, maestro discreto de la poesía de posguerra."
    ]
  },
  {
    id: "juan-ramon-jimenez",
    qid: "Q131318",
    wikiquote: "Juan Ramón Jiménez",
    ambito: "universal",
    corriente: "Modernismo / Poesía pura",
    glosa: [
      "Nobel y orfebre del verso: buscó la «poesía desnuda», depurada de todo adorno hasta el hueso de la palabra.",
      "Su «Platero y yo» convirtió la ternura andaluza en clásico universal de la infancia."
    ]
  },
  {
    id: "gloria-fuertes",
    qid: "Q3323486",
    wikiquote: "Gloria Fuertes",
    ambito: "universal",
    corriente: "Posguerra / Poesía social",
    glosa: [
      "Poeta del pueblo: hizo de la calle, el humor y la ternura una voz contra la solemnidad y la pobreza.",
      "Conocida por la tele infantil, escondía tras ella una poeta antibélica, feminista y profundamente libre."
    ]
  },
  {
    id: "ana-maria-matute",
    qid: "Q235403",
    wikiquote: "Ana María Matute",
    ambito: "universal",
    corriente: "Narrativa de posguerra",
    glosa: [
      "Narradora de la infancia herida: contó la guerra civil desde los ojos de los niños que la sufrieron.",
      "Premio Cervantes, mezcló realismo y cuento de hadas para hablar de la crueldad y la inocencia."
    ]
  },
  {
    id: "carmen-laforet",
    qid: "Q269123",
    wikiquote: "Carmen Laforet",
    ambito: "universal",
    corriente: "Narrativa de posguerra",
    glosa: [
      "Con «Nada», a los 23 años, dio voz al desencanto de la juventud en la Barcelona gris de la posguerra.",
      "Su existencialismo sobrio abrió camino a la novela femenina española del siglo XX."
    ]
  },
  {
    id: "rosa-chacel",
    qid: "Q468852",
    wikiquote: "Rosa Chacel",
    ambito: "universal",
    corriente: "Generación del 27 / Exilio",
    glosa: [
      "Prosista intelectual del 27: discípula de Ortega, hizo de la memoria y la conciencia su materia literaria.",
      "Exiliada largos años, reivindicó una literatura femenina exigente, lejos de toda concesión."
    ]
  },
  {
    id: "salvador-de-madariaga",
    qid: "Q702468",
    wikiquote: "Salvador de Madariaga",
    ambito: "universal",
    corriente: "Liberalismo / Europeísmo",
    glosa: [
      "Diplomático y ensayista liberal: soñó una Europa unida décadas antes de que existiera, desde el exilio.",
      "Historiador de España y América, defendió la libertad individual frente a todos los totalitarismos."
    ]
  },
  {
    id: "luis-bunuel",
    qid: "Q51545",
    wikiquote: "Luis Buñuel",
    ambito: "universal",
    corriente: "Surrealismo / Cine",
    glosa: [
      "Maestro del cine surrealista: de «Un perro andaluz» a «Viridiano», hizo del sueño un escalpelo social.",
      "Ateo confeso y burlón, desnudó la hipocresía burguesa y religiosa con una imaginación libérrima."
    ]
  },
  {
    id: "salvador-dali",
    qid: "Q5577",
    wikiquote: "Salvador Dalí",
    ambito: "universal",
    corriente: "Surrealismo",
    glosa: [
      "Genio y showman del surrealismo: relojes blandos y delirios oníricos hechos con técnica de viejo maestro.",
      "Construyó su propia leyenda tanto como su obra —el personaje Dalí fue su mayor performance."
    ]
  },
  {
    id: "pablo-picasso",
    qid: "Q5593",
    wikiquote: "Pablo Picasso",
    ambito: "universal",
    corriente: "Cubismo / Vanguardia",
    glosa: [
      "Reinventó el arte del siglo XX: del cubismo al «Guernica», cada etapa abrió un lenguaje nuevo.",
      "Malagueño universal, hizo de la pintura un grito político y una libertad formal sin precedentes."
    ]
  },
  {
    id: "joan-miro",
    qid: "Q152384",
    wikiquote: "Joan Miró",
    ambito: "universal",
    corriente: "Surrealismo / Abstracción",
    glosa: [
      "Inventó un alfabeto propio: estrellas, ojos y manchas que parecen juego infantil y son cosmos riguroso.",
      "Catalán y universal, quiso «asesinar la pintura» para hacerla nacer otra vez, más libre."
    ]
  },
  {
    id: "antoni-gaudi",
    qid: "Q25328",
    wikiquote: "Antoni Gaudí",
    ambito: "universal",
    corriente: "Modernismo / Arquitectura",
    glosa: [
      "Arquitecto de la naturaleza hecha piedra: la Sagrada Família y el Park Güell son geometría orgánica.",
      "Genio solitario y devoto, llevó el modernismo catalán a una forma que aún parece de otro tiempo."
    ]
  },
  {
    id: "joaquin-sorolla",
    qid: "Q351746",
    wikiquote: "Joaquín Sorolla",
    ambito: "universal",
    corriente: "Luminismo / Impresionismo",
    glosa: [
      "Pintor de la luz mediterránea: playas, niños y velas blancas capturados con pincelada veloz y feliz.",
      "Valenciano universal, hizo del sol y el mar un género propio que conquistó Europa y América."
    ]
  },

  // ── Intelectuales universales trascendidos (filosofía, letras, ciencia) ──────
  {
    id: "socrates",
    qid: "Q913",
    wikiquote: "Sócrates",
    ambito: "universal",
    corriente: "Filosofía clásica",
    glosa: [
      "Padre de la filosofía occidental: no escribió nada, pero su método de preguntar fundó el pensar crítico.",
      "Murió por la cicuta antes que renunciar a examinar la vida —«una vida sin examen no merece ser vivida»."
    ]
  },
  {
    id: "platon",
    qid: "Q859",
    wikiquote: "Platón",
    ambito: "universal",
    corriente: "Filosofía clásica",
    glosa: [
      "Fundó la Academia y escribió en diálogos: la teoría de las Ideas marcó dos milenios de pensamiento.",
      "Su «República» imaginó la ciudad justa y sigue siendo el primer gran tratado de filosofía política."
    ]
  },
  {
    id: "aristoteles",
    qid: "Q868",
    wikiquote: "Aristóteles",
    ambito: "universal",
    corriente: "Filosofía clásica",
    glosa: [
      "Enciclopedia viviente: fundó la lógica, la biología y la ética como disciplinas, midiendo el mundo entero.",
      "Maestro del «término medio», pensó al ser humano como «animal político» que solo se realiza en comunidad."
    ]
  },
  {
    id: "seneca",
    qid: "Q2054",
    wikiquote: "Séneca",
    ambito: "universal",
    corriente: "Estoicismo",
    glosa: [
      "Estoico hispano-romano: enseñó a gobernar las pasiones y a mirar la muerte sin temblar.",
      "Consejero de Nerón y víctima suya, escribió que la libertad interior no la quita ningún tirano."
    ]
  },
  {
    id: "marco-aurelio",
    qid: "Q1430",
    wikiquote: "Marco Aurelio",
    ambito: "universal",
    corriente: "Estoicismo",
    glosa: [
      "Emperador y filósofo: sus «Meditaciones» son notas privadas para vivir con virtud en el poder.",
      "Encarnó al «rey filósofo» de Platón —gobernó un imperio recordándose cada día su propia pequeñez."
    ]
  },
  {
    id: "epicteto",
    qid: "Q183144",
    wikiquote: "Epicteto",
    ambito: "universal",
    corriente: "Estoicismo",
    glosa: [
      "De esclavo a maestro: enseñó que no nos perturban las cosas, sino la opinión que tenemos de ellas.",
      "Distinguió lo que depende de nosotros de lo que no —ahí, dijo, empieza toda serenidad."
    ]
  },
  {
    id: "montaigne",
    qid: "Q41568",
    wikiquote: "Michel de Montaigne",
    ambito: "universal",
    corriente: "Humanismo renacentista",
    glosa: [
      "Inventó el ensayo: se tomó a sí mismo como objeto de estudio para pensar la condición humana.",
      "Escéptico tolerante, su «¿Qué sé yo?» fue una defensa de la duda contra todos los fanatismos."
    ]
  },
  {
    id: "spinoza",
    qid: "Q35802",
    wikiquote: "Baruch Spinoza",
    ambito: "universal",
    corriente: "Racionalismo",
    glosa: [
      "Pulía lentes y pensaba a Dios como naturaleza: una ética demostrada «a la manera de la geometría».",
      "Excomulgado y pobre, defendió la libertad de conciencia siglos antes de que fuera derecho."
    ]
  },
  {
    id: "kant",
    qid: "Q9312",
    wikiquote: "Immanuel Kant",
    ambito: "universal",
    corriente: "Idealismo / Ilustración",
    glosa: [
      "Giro copernicano de la filosofía: mostró que la mente da forma a lo que conoce del mundo.",
      "Su imperativo categórico hizo de la dignidad humana el centro de la ética moderna."
    ]
  },
  {
    id: "nietzsche",
    qid: "Q9358",
    wikiquote: "Friedrich Nietzsche",
    ambito: "universal",
    corriente: "Vitalismo / Crítica de la moral",
    glosa: [
      "Martillo de los ídolos: anunció la «muerte de Dios» y desafió a crear valores propios sin red.",
      "Pensó la vida como voluntad de potencia y el eterno retorno como prueba de amor al destino."
    ]
  },
  {
    id: "schopenhauer",
    qid: "Q38193",
    wikiquote: "Arthur Schopenhauer",
    ambito: "universal",
    corriente: "Pesimismo / Idealismo",
    glosa: [
      "Filósofo del pesimismo: vio el mundo como voluntad ciega y la vida como péndulo entre dolor y hastío.",
      "Halló alivio en el arte y la compasión —y abrió la puerta de Occidente al pensamiento de Oriente."
    ]
  },
  {
    id: "karl-marx",
    qid: "Q9061",
    wikiquote: "Karl Marx",
    ambito: "universal",
    corriente: "Materialismo histórico",
    glosa: [
      "Pensó el capital como relación social e histórica: el motor de la historia es la lucha de clases.",
      "«Los filósofos solo han interpretado el mundo; de lo que se trata es de transformarlo»."
    ]
  },
  {
    id: "rousseau",
    qid: "Q6527",
    wikiquote: "Jean-Jacques Rousseau",
    ambito: "universal",
    corriente: "Ilustración / Contractualismo",
    glosa: [
      "«El hombre nace libre y por todas partes está encadenado»: fundó la idea moderna de soberanía popular.",
      "Entre el contrato social y la educación natural, inspiró revoluciones y romanticismos a la vez."
    ]
  },
  {
    id: "voltaire",
    qid: "Q9068",
    wikiquote: "Voltaire",
    ambito: "universal",
    corriente: "Ilustración",
    glosa: [
      "Azote del fanatismo: con ironía demoledora defendió la tolerancia, la razón y la libertad de prensa.",
      "Símbolo de la Ilustración, hizo del ingenio un arma cívica contra el dogma y la superstición."
    ]
  },
  {
    id: "simone-de-beauvoir",
    qid: "Q7197",
    wikiquote: "Simone de Beauvoir",
    ambito: "universal",
    corriente: "Existencialismo / Feminismo",
    glosa: [
      "«No se nace mujer: se llega a serlo» —«El segundo sexo» fundó el feminismo filosófico moderno.",
      "Existencialista de la libertad, vivió y pensó la igualdad como proyecto a construir, no como dato."
    ]
  },
  {
    id: "albert-camus",
    qid: "Q34670",
    wikiquote: "Albert Camus",
    ambito: "universal",
    corriente: "Existencialismo / Absurdo",
    glosa: [
      "Filósofo del absurdo: ante un mundo sin sentido, propuso la rebeldía lúcida y la solidaridad.",
      "«Hay que imaginar a Sísifo feliz» —Nobel que unió pensamiento, novela y compromiso moral."
    ]
  },
  {
    id: "jean-paul-sartre",
    qid: "Q9364",
    wikiquote: "Jean-Paul Sartre",
    ambito: "universal",
    corriente: "Existencialismo",
    glosa: [
      "«La existencia precede a la esencia»: condenó al ser humano a ser libre y responsable de lo que hace.",
      "Rechazó el Nobel y se metió en todas las causas —el intelectual comprometido por excelencia."
    ]
  },
  {
    id: "bertrand-russell",
    qid: "Q33760",
    wikiquote: "Bertrand Russell",
    ambito: "universal",
    corriente: "Filosofía analítica / Pacifismo",
    glosa: [
      "Lógico y pacifista: refundó las matemáticas y combatió la guerra y la superstición con igual energía.",
      "Nobel de literatura y activista hasta los noventa, hizo de la duda razonada una ética pública."
    ]
  },
  {
    id: "wittgenstein",
    qid: "Q9391",
    wikiquote: "Ludwig Wittgenstein",
    ambito: "universal",
    corriente: "Filosofía del lenguaje",
    glosa: [
      "Revolucionó dos veces la filosofía: «de lo que no se puede hablar hay que callar», y luego se contradijo.",
      "Pensó el lenguaje como juego y forma de vida —los límites del idioma son los del mundo."
    ]
  },
  {
    id: "gandhi",
    qid: "Q1001",
    wikiquote: "Mahatma Gandhi",
    ambito: "universal",
    corriente: "No violencia",
    glosa: [
      "Liberó a un país sin disparar un tiro: la resistencia no violenta como fuerza política y moral.",
      "«Sé tú el cambio que quieres ver en el mundo» —su satyagraha inspiró a King y a Mandela."
    ]
  },
  {
    id: "tolstoi",
    qid: "Q7243",
    wikiquote: "León Tolstói",
    ambito: "universal",
    corriente: "Realismo / Anarquismo cristiano",
    glosa: [
      "Gigante de la novela: «Guerra y paz» y «Anna Karénina» abarcan una sociedad entera y un alma a la vez.",
      "En su vejez renunció a la riqueza y predicó la no violencia —un conde convertido en profeta laico."
    ]
  },
  {
    id: "dostoyevski",
    qid: "Q991",
    wikiquote: "Fiódor Dostoyevski",
    ambito: "universal",
    corriente: "Realismo psicológico",
    glosa: [
      "Sondeó el sótano del alma humana: culpa, fe y libertad en «Crimen y castigo» y «Los hermanos Karamázov».",
      "Condenado a muerte y perdonado en el último instante, escribió como quien ha mirado el abismo."
    ]
  },
  {
    id: "oscar-wilde",
    qid: "Q30875",
    wikiquote: "Oscar Wilde",
    ambito: "universal",
    corriente: "Esteticismo",
    glosa: [
      "Rey del ingenio: sus aforismos y comedias hicieron del arte por el arte una religión brillante.",
      "Encarcelado por su homosexualidad, pagó caro el desafío a la moral victoriana que tanto ridiculizó."
    ]
  },
  {
    id: "virginia-woolf",
    qid: "Q40909",
    wikiquote: "Virginia Woolf",
    ambito: "universal",
    corriente: "Modernismo / Feminismo",
    glosa: [
      "Renovó la novela con el fluir de la conciencia: el tiempo interior por encima de la trama.",
      "«Una habitación propia» reclamó para las mujeres independencia material como condición de la creación."
    ]
  },
  {
    id: "albert-einstein",
    qid: "Q937",
    wikiquote: "Albert Einstein",
    ambito: "universal",
    corriente: "Física moderna",
    glosa: [
      "Reescribió el espacio y el tiempo: la relatividad cambió nuestra idea misma del universo.",
      "Pacifista y refugiado, usó su fama para defender la paz, los derechos civiles y la duda científica."
    ]
  },
  {
    id: "sigmund-freud",
    qid: "Q9215",
    wikiquote: "Sigmund Freud",
    ambito: "universal",
    corriente: "Psicoanálisis",
    glosa: [
      "Descubrió el inconsciente como continente: sueños, lapsus y deseos gobiernan más de lo que creemos.",
      "Discutido y fundacional, hizo de la mente un territorio a interpretar, no solo a medir."
    ]
  },
  {
    id: "carl-jung",
    qid: "Q41532",
    wikiquote: "Carl Gustav Jung",
    ambito: "universal",
    corriente: "Psicología analítica",
    glosa: [
      "Pensó el inconsciente colectivo y los arquetipos: símbolos compartidos por toda la humanidad.",
      "Discípulo y luego rival de Freud, buscó en mitos y religiones las claves del alma."
    ]
  },
  {
    id: "umberto-eco",
    qid: "Q12807",
    wikiquote: "Umberto Eco",
    ambito: "universal",
    corriente: "Semiótica / Novela",
    glosa: [
      "Semiólogo y novelista: «El nombre de la rosa» convirtió la teoría de los signos en thriller medieval.",
      "Erudito irónico, estudió cómo leemos el mundo —de la alta cultura al cómic, sin desdén por nada."
    ]
  },
  {
    id: "jorge-luis-borges",
    qid: "Q909",
    wikiquote: "Jorge Luis Borges",
    ambito: "universal",
    corriente: "Literatura fantástica",
    glosa: [
      "Bibliotecario del infinito: laberintos, espejos y bibliotecas que contienen todos los libros posibles.",
      "Hizo del cuento breve un universo metafísico —«siempre imaginé que el paraíso sería una biblioteca»."
    ]
  },
  {
    id: "garcia-marquez",
    qid: "Q5878",
    wikiquote: "Gabriel García Márquez",
    ambito: "universal",
    corriente: "Realismo mágico",
    glosa: [
      "Inventó Macondo: «Cien años de soledad» hizo del realismo mágico el rostro literario de América Latina.",
      "Nobel y periodista, contó la historia del continente como mito, memoria y maravilla cotidiana."
    ]
  },
  {
    id: "octavio-paz",
    qid: "Q46739",
    wikiquote: "Octavio Paz",
    ambito: "universal",
    corriente: "Poesía / Ensayo",
    glosa: [
      "Poeta y ensayista: «El laberinto de la soledad» pensó la identidad mexicana con lucidez universal.",
      "Nobel libre y crítico, defendió la poesía y la democracia frente a todos los dogmatismos."
    ]
  },
  {
    id: "pablo-neruda",
    qid: "Q34189",
    wikiquote: "Pablo Neruda",
    ambito: "universal",
    corriente: "Poesía / Compromiso",
    glosa: [
      "Voz torrencial de América: del amor de los «Veinte poemas» al «Canto general» de un continente.",
      "Nobel y militante, hizo de la poesía un acto público —cantó al mar, a la cebolla y a la justicia."
    ]
  },
  {
    id: "simon-bolivar",
    qid: "Q8605",
    wikiquote: "Simón Bolívar",
    ambito: "universal",
    corriente: "Independentismo / Republicanismo",
    glosa: [
      "El Libertador: condujo la independencia de media Sudamérica y soñó una patria grande unida.",
      "Su «Carta de Jamaica» pensó el futuro político del continente —murió desengañado pero profético."
    ]
  },
  {
    id: "jose-marti",
    qid: "Q103285",
    wikiquote: "José Martí",
    ambito: "universal",
    corriente: "Independentismo / Modernismo",
    glosa: [
      "Apóstol de la independencia cubana: unió poesía modernista y lucha política hasta morir en combate.",
      "«Nuestra América» reivindicó una identidad propia frente al expansionismo —pensador de la dignidad."
    ]
  }
];

// ── Utilidades de red ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (r.ok) return r.json();
    if (r.status === 429) { await sleep(3000 * (i + 1)); continue; } // backoff ante rate-limit
    throw new Error(`HTTP ${r.status} en ${url}`);
  }
  throw new Error(`HTTP 429 (agotados reintentos) en ${url}`);
}

// ── Wikidata: metadatos por QID (CC0) ────────────────────────────────────────
async function fetchWikidata(qid) {
  const query = `
    SELECT ?personLabel ?birth ?death ?image
           (GROUP_CONCAT(DISTINCT ?occLabel; separator=", ") AS ?ocupaciones)
           (GROUP_CONCAT(DISTINCT ?obraLabel; separator=" ||| ") AS ?obras) WHERE {
      BIND(wd:${qid} AS ?person)
      OPTIONAL { ?person wdt:P569 ?birth }
      OPTIONAL { ?person wdt:P570 ?death }
      OPTIONAL { ?person wdt:P18  ?image }
      OPTIONAL { ?person wdt:P106 ?occ . ?occ rdfs:label ?occLabel . FILTER(lang(?occLabel)="es") }
      OPTIONAL { ?person wdt:P800 ?obra . ?obra rdfs:label ?obraLabel . FILTER(lang(?obraLabel)="es") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" }
    } GROUP BY ?personLabel ?birth ?death ?image`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJSON(url);
  const b = data.results.bindings[0] || {};
  const year = (iso) => (iso?.value ? iso.value.slice(0, iso.value.startsWith("-") ? 5 : 4).replace(/^\+/, "") : null);
  return {
    nombre: b.personLabel?.value || null,
    nacimiento: year(b.birth),
    muerte: year(b.death),
    ocupacion: b.ocupaciones?.value ? b.ocupaciones.value.split(", ").filter(Boolean) : [],
    obras: b.obras?.value ? b.obras.value.split(" ||| ").filter(Boolean) : [],
    imagenFile: b.image?.value ? decodeURIComponent(b.image.value.split("/").pop()) : null
  };
}

// ── Commons: URL de retrato + licencia (per-file) ────────────────────────────
async function fetchRetrato(fileName, width = 480) {
  if (!fileName) return { url: null, licencia: null, autor: null };
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
  let licencia = null, autor = null;
  try {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent("File:" + fileName)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`;
    const data = await getJSON(api);
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    const ext = page?.imageinfo?.[0]?.extmetadata || {};
    licencia = ext.LicenseShortName?.value || null;
    autor = (ext.Artist?.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
    if (autor) {
      // Commons a veces concatena el mismo nombre dos veces al aplanar el HTML,
      // con o sin espacio en medio ("Unknown author Unknown author").
      const m = autor.match(/^(.+?)\s*\1$/);
      if (m) autor = m[1].trim();
    }
  } catch { /* licencia opcional */ }
  return { url, licencia, autor };
}

// ── Wikiquote: citas reales (CC-BY-SA) ───────────────────────────────────────
// Parsea wikitext: líneas que empiezan por "* " son citas; sublíneas con
// {{Fuente}} o "** " aportan la referencia → marca verificacion.
async function fetchCitas(pageName, max = 4) {
  if (!pageName) return []; // figura sin página en Wikiquote ES ⇒ solo glosa
  const url = `https://es.wikiquote.org/w/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json&origin=*`;
  let data;
  try { data = await getJSON(url); } catch { return []; }
  const wikitext = data.parse?.wikitext?.["*"];
  if (!wikitext) return [];

  const lines = wikitext.split("\n");
  const citas = [];
  for (let i = 0; i < lines.length && citas.length < max; i++) {
    const ln = lines[i];
    const m = ln.match(/^\*\s+(?!\*)(.+)$/); // "* " pero no "** "
    if (!m) continue;
    let texto = stripWiki(m[1]);
    if (texto.length < 25 || texto.length > 320) continue; // descarta cabeceras/ruido

    // ¿la línea siguiente es una fuente ("** ..." o {{Fuente}})?
    let fuente = null;
    const next = lines[i + 1] || "";
    const fm = next.match(/^\*\*\s+(.+)$/);
    if (fm) fuente = stripWiki(fm[1]);
    const tm = m[1].match(/\{\{[Ff]uente\|([^}]+)\}\}/);
    if (!fuente && tm) fuente = stripWiki(tm[1]);

    citas.push({
      texto,
      fuente: fuente || null,
      verificacion: fuente ? "real-sourced" : "real-unsourced"
    });
  }
  return citas;
}

function stripWiki(s) {
  return s
    .replace(/\{\{[^}]*\}\}/g, "")           // plantillas
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2") // enlaces [[a|b]]→b
    .replace(/'''?/g, "")                     // negrita/cursiva
    .replace(/<ref[^>]*>.*?<\/ref>/gs, "")    // refs
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<[^>]+>/g, "")                  // html
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Ensamblaje por figura ────────────────────────────────────────────────────
async function buildPersonaje(seed) {
  process.stderr.write(`· ${seed.id} … `);
  const wd = await fetchWikidata(seed.qid);
  const retrato = await fetchRetrato(wd.imagenFile);
  const citas = await fetchCitas(seed.wikiquote);

  // Posts híbridos: primero las citas reales, intercaladas con glosa IA.
  const posts = [];
  citas.forEach((c, i) => {
    posts.push({
      id: `${seed.id}-cita-${i + 1}`,
      modo: "cita",
      texto: c.texto,
      fuente: c.fuente,
      verificacion: c.verificacion
    });
  });
  seed.glosa.forEach((g, i) => {
    posts.push({
      id: `${seed.id}-glosa-${i + 1}`,
      modo: "glosa",
      texto: g,
      verificacion: "ai-gloss"
    });
  });

  // Posts de OBRA (Instagram-style): imagen real de Commons + pie factual.
  // La imagen es real-sourced (obra/intervención verificable); el pie es
  // descriptivo (título, año), NO una cita en 1ª persona.
  let nImg = 0;
  for (let i = 0; i < (seed.imagenes || []).length; i++) {
    const im = seed.imagenes[i];
    const r = await fetchRetrato(im.file, 800);
    if (!r.url) continue;
    nImg++;
    posts.push({
      id: `${seed.id}-obra-${i + 1}`,
      modo: "imagen",
      texto: im.texto,
      media: r.url,
      fuente: ["Commons", r.licencia, r.autor].filter(Boolean).join(" · "),
      verificacion: "real-sourced"
    });
  }

  process.stderr.write(`${citas.length} citas, ${nImg} obras, retrato ${retrato.url ? "✓" : "✗"}\n`);
  return {
    id: seed.id,
    nombre: wd.nombre || seed.id,
    nacimiento: wd.nacimiento,
    muerte: wd.muerte,
    ambito: seed.ambito,
    corriente: seed.corriente,
    ocupacion: wd.ocupacion,
    obras: wd.obras.slice(0, 6),
    retrato_url: retrato.url,
    retrato_licencia: retrato.licencia,
    retrato_autor: retrato.autor,
    fuente: {
      wikidata: `https://www.wikidata.org/wiki/${seed.qid}`,
      wikiquote: seed.wikiquote ? `https://es.wikiquote.org/wiki/${encodeURIComponent(seed.wikiquote)}` : null
    },
    posts
  };
}

// Fusión MONÓTONA: las APIs (Wikidata/Wikiquote) responden 429 de forma no
// determinista, así que un re-run puede perder citas o retrato de una figura.
// Conservamos lo mejor de cada campo entre el build fresco y el JSON previo,
// de modo que re-ejecutar solo acumula mejoras, nunca degrada.
function mergeMonotono(fresh, prev) {
  if (!prev) return fresh;
  const citasFresh = fresh.posts.filter(p => p.modo === "cita");
  const citasPrev = (prev.posts || []).filter(p => p.modo === "cita");
  // Quédate con el conjunto de citas reales más grande.
  if (citasPrev.length > citasFresh.length) {
    const otros = fresh.posts.filter(p => p.modo !== "cita");
    fresh.posts = [...citasPrev, ...otros];
  }
  // Preserva retrato si el run fresco lo perdió.
  if (!fresh.retrato_url && prev.retrato_url) {
    fresh.retrato_url = prev.retrato_url;
    fresh.retrato_licencia = prev.retrato_licencia;
    fresh.retrato_autor = prev.retrato_autor;
  }
  // Preserva obras (P800) si el run fresco las perdió.
  if ((!fresh.obras || !fresh.obras.length) && prev.obras && prev.obras.length) {
    fresh.obras = prev.obras;
  }
  return fresh;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Carga el JSON previo (si existe) para la fusión monótona.
  let prevById = new Map();
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8"));
    for (const p of prev.personajes || []) prevById.set(p.id, p);
  } catch { /* primera ejecución: sin previo */ }

  const personajes = [];
  for (const seed of SEEDS) {
    try {
      const fresh = await buildPersonaje(seed);
      personajes.push(mergeMonotono(fresh, prevById.get(seed.id)));
    } catch (e) {
      process.stderr.write(`ERROR ${seed.id}: ${e.message}\n`);
      // En error total, conserva el previo intacto si existe.
      const prev = prevById.get(seed.id);
      if (prev) personajes.push(prev);
    }
    await sleep(800); // cortesía con Wikiquote/Commons; evita rate-limit en re-runs
  }
  const out = {
    _meta: {
      generado: new Date().toISOString().slice(0, 10),
      fuente_datos: "Wikidata (CC0) + Wikiquote (CC-BY-SA) + Commons (per-file)",
      nota_glosa: "Los posts modo:glosa son redacción IA contextual (verificacion ai-gloss), no citas literales.",
      total: personajes.length
    },
    personajes
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2), "utf8");
  process.stderr.write(`\n✓ ${personajes.length} personajes → ${OUT}\n`);
}

main();
