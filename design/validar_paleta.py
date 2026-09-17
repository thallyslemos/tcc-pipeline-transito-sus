# Validacao numerica da paleta do Design System V01-V89 v2.1
# Converte OKLCH -> sRGB, mede contraste WCAG e distancia entre tokens.
# Uso: python3 validar_paleta.py

import math

# ---------- OKLCH -> sRGB ----------
def oklab_to_lrgb(L,a,b):
    l_=L+0.3963377774*a+0.2158037573*b
    m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r=+4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    return r,g,bb

def f(c):
    c=max(0.0,min(1.0,c))
    return 12.92*c if c<=0.0031308 else 1.055*(c**(1/2.4))-0.055

def oklch_hex(L,C,H, clamp=True):
    a=C*math.cos(math.radians(H)); b=C*math.sin(math.radians(H))
    r,g,bl=oklab_to_lrgb(L,a,b)
    ing = all(-1e-4 <= v <= 1.0001 for v in (r,g,bl))
    if not ing and clamp:
        lo,hi=0.0,C
        for _ in range(40):
            mid=(lo+hi)/2
            aa=mid*math.cos(math.radians(H)); bb2=mid*math.sin(math.radians(H))
            rr,gg,bb3=oklab_to_lrgb(L,aa,bb2)
            if all(-1e-4<=v<=1.0001 for v in (rr,gg,bb3)): lo=mid
            else: hi=mid
        C=lo
        a=C*math.cos(math.radians(H)); b=C*math.sin(math.radians(H))
        r,g,bl=oklab_to_lrgb(L,a,b)
    return "#%02X%02X%02X"%tuple(round(f(v)*255) for v in (r,g,bl)), C, ing

def lum(hexs):
    hexs=hexs.lstrip('#')
    c=[int(hexs[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)


# ---------------------------------------------------------------- tokens finais
CAT = {  # OKLCH L=0,52  C=0,088 — 4 matizes + 1 neutro
    "cat-moto":     ("#686098", (0.52, 0.088, 290)),
    "cat-pedestre": ("#676F2F", (0.52, 0.088, 115)),
    "cat-auto":     ("#02787D", (0.52, 0.088, 200)),
    "cat-ciclista": ("#8B5479", (0.52, 0.088, 340)),
    "cat-outros":   ("#8A9096", None),
}
RISK = ["#FBEBD9", "#F6D0AE", "#E9A87F", "#CE7551", "#9E3E24"]
UI   = {"brand": "#2F5C93", "ok": "#1D6746", "attention": "#B57A2E",
        "attention-ink": "#744C00", "alert": "#AB2F3F"}
TEXTO = {"ink": "#22262B", "ink-2": "#5B6169", "ink-3": "#838A92",
         "brand": "#2F5C93", "attention-ink": "#744C00", "ok": "#1D6746",
         "alert": "#AB2F3F"}

def dist(a, b):
    return sum((int(a[1+2*i:3+2*i], 16) - int(b[1+2*i:3+2*i], 16))**2 for i in range(3))**0.5

print("== 1 · paleta categorica: reproducao a partir de OKLCH ==")
for k, (hx, spec) in CAT.items():
    if spec:
        calc, c, _ = oklch_hex(*spec)
        ok = "ok" if calc == hx else f"DIVERGE (calculado {calc})"
        print(f"  {k:<13} {hx}  L={spec[0]} C={spec[1]} h={spec[2]:>3}  {ok}")
    else:
        print(f"  {k:<13} {hx}  neutro deliberado")

print("\n== 2 · rampa de risco: luminancia estritamente decrescente? ==")
ys = [lum(h) for h in RISK]
print("   Y =", " > ".join(f"{y:.3f}" for y in ys))
print("   monotonica:", all(ys[i] > ys[i+1] for i in range(4)),
      "| razao entre degraus:", " ".join(f"{ys[i]/ys[i+1]:.2f}x" for i in range(4)))
print("   -> imprime em escala de cinza e e segura para deuteranopia")

print("\n== 3 · rotulo sobre a rampa ==")
for i, h in enumerate(RISK, 1):
    a, b = cr(h, "#22262B"), cr(h, "#FAFAF9")
    print(f"   risk-{i} {h}  tinta {a:5.2f}  canvas {b:5.2f}  -> usar {'tinta' if a >= b else 'canvas'}")

print("\n== 4 · colisoes: dado x interface (limite adotado 60) ==")
pior, ruins = 999, 0
for k, (hx, _) in CAT.items():
    for rk, rv in {**{f"risk-{i}": v for i, v in enumerate(RISK, 1)}, **UI}.items():
        d = dist(hx, rv)
        pior = min(pior, d)
        if d < 60:
            ruins += 1
            print(f"   ! {k} {hx} x {rk} {rv} = {d:.0f}")
print(f"   pares abaixo de 60: {ruins} | menor distancia do conjunto: {pior:.0f}")
print("   obs: a separacao final e por PAPEL (dado preenche, interface traca),")
print("        entao proximidade entre um preenchimento e um traco nao confunde.")

print("\n== 5 · contraste WCAG do texto ==")
for fundo, nome in [("#FFFFFF", "claro"), ("#1D2024", "escuro")]:
    print(f"   -- fundo {nome} {fundo}")
    pal = TEXTO if fundo == "#FFFFFF" else {"ink": "#EDEDEA", "ink-2": "#A9AEB4",
        "ink-3": "#7C838B", "brand": "#7FA8DA", "attention-ink": "#D9A75E",
        "ok": "#74B592", "alert": "#E17177"}
    for n, h in pal.items():
        v = cr(h, fundo)
        sel = "AA" if v >= 4.5 else ("AA-large" if v >= 3 else "REPROVA")
        print(f"      {n:<14} {h}  {v:5.2f}  {sel}")
