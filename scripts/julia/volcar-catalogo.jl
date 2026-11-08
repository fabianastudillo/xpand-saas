#= Volcado del catalogo de un checkout de xpand a JSON, para scripts/importar-casos.ts.

   Uso (desde cualquier carpeta; el checkout NO se modifica):

       GTNEP_SALIDAS=<tmp>/salidas GTNEP_TEMP=<tmp>/tmp TMPDIR=<tmp>/tmp \
           julia --project=<checkout> scripts/julia/volcar-catalogo.jl <salida.json>

   Carga el modulo del checkout (PlanificadorGTNEP), pide el catalogo con la misma funcion que sirve /api/catalogo
   (`Catalogo.catalogo_json`) y escribe, por motor y sistema, los campos del catalogo que el importador puede usar mas
   `raiz`, `archivos` y `esquema_red`. El importador decide que se copia a un manifiesto (lista blanca de casos y de
   campos): este volcado lleva rutas del disco y nombres de casos internos, asi que va a una carpeta temporal y nunca
   al repositorio.

   Escrituras: la construccion del catalogo guarda una cache en `<GTNEP_SALIDAS>/cache`; por eso GTNEP_SALIDAS es
   obligatoria aqui (sin ella xpand escribiria en `<checkout>/_salidas`). =#

if length(ARGS) != 1
    println(stderr, "uso: julia --project=<checkout> volcar-catalogo.jl <salida.json>")
    exit(2)
end
if isempty(get(ENV, "GTNEP_SALIDAS", ""))
    println(stderr, "GTNEP_SALIDAS no esta definida: sin ella xpand escribiria su cache dentro del checkout.")
    exit(2)
end

using PlanificadorGTNEP
import JSON

const Catalogo = PlanificadorGTNEP.Catalogo

const CAMPOS_MOTOR = ("id", "nombre", "formulacion", "familia", "esquema_red", "raiz")
const CAMPOS_SISTEMA = ("id", "nombre", "barras", "dificultad", "nota", "familia", "variante", "fuente",
                        "modelo_datos", "tecnologias_datos", "referencias", "disponible", "archivos")

tomar(d, campos) = Dict{String,Any}(k => d[k] for k in campos if haskey(d, k) && d[k] !== nothing)

function sistema_volcado(s)
    out = tomar(s, CAMPOS_SISTEMA)
    e = get(s, "extra", nothing)
    if e isa AbstractDict
        for k in ("datos_motor", "datos_sistema")
            v = get(e, k, nothing)
            v isa AbstractString && !isempty(v) && (out[k] = String(v))
        end
    end
    return out
end

function volcar(salida)
    c = Catalogo.catalogo_json()
    motores = [merge(tomar(m, CAMPOS_MOTOR),
                     Dict{String,Any}("sistemas" => [sistema_volcado(s) for s in m["sistemas"]]))
               for m in c["motores"]]
    open(salida, "w") do io
        JSON.print(io, Dict{String,Any}("motores" => motores), 1)
    end
    n = sum(length(m["sistemas"]) for m in motores; init = 0)
    println("volcados $(length(motores)) motores y $n sistemas en $salida")
end

volcar(abspath(ARGS[1]))
