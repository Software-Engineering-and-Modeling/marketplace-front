import { useState, useMemo } from "react";
import "./checkout.css";

/* ---------- utilidades ---------- */
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dg = (s) => s.replace(/\D/g, "");
const mask = {
  cpf: (v) => { v = dg(v).slice(0, 11); return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); },
  cep: (v) => { v = dg(v).slice(0, 8); return v.length > 5 ? v.slice(0, 5) + "-" + v.slice(5) : v; },
  tel: (v) => {
    v = dg(v).slice(0, 11);
    if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    if (v.length > 2) return v.replace(/(\d{2})(\d+)/, "($1) $2");
    return v;
  },
  card: (v) => dg(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "),
  exp: (v) => { v = dg(v).slice(0, 4); return v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v; },
  cvv: (v) => dg(v).slice(0, 4),
  uf: (v) => v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase(),
};
const cpfOk = (c) => {
  c = dg(c);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += c[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 != c[t]) return false;
  }
  return true;
};
const luhn = (n) => {
  n = dg(n);
  let s = 0, a = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = +n[i];
    if (a) { d *= 2; if (d > 9) d -= 9; }
    s += d; a = !a;
  }
  return n.length >= 13 && s % 10 === 0;
};
const expOk = (v) => {
  const [m, y] = v.split("/").map(Number);
  if (!m || m < 1 || m > 12 || v.length !== 5) return false;
  const now = new Date();
  return (2000 + y) * 12 + m >= now.getFullYear() * 12 + now.getMonth() + 1;
};
const brand = (n) => {
  n = dg(n);
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(636|606|50)/.test(n)) return "Elo";
  return "";
};
const rnd = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/* ---------- dados ---------- */
const PRODUTOS = [
  { id: 1, n: "Jarra Maré", p: 189, c: "#1F4BFF" },
  { id: 2, n: "Conjunto 4 canecas", p: 136, c: "#101A33" },
  { id: 3, n: "Prato fundo Dune", p: 59.9, c: "#7FA6A0" },
];
const FRETES = {
  eco: { n: "Econômica", d: "7 a 10 dias úteis", p: 18.9 },
  exp: { n: "Expressa", d: "2 a 3 dias úteis", p: 34.9 },
};
const FRETE_GRATIS = 400;
const CUPONS = { MARE10: 0.1 };

const validate = (f, step, metodo) => {
  const e = {};
  if (step === 0) {
    if (f.nome.trim().split(" ").filter(Boolean).length < 2) e.nome = "Informe nome e sobrenome.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Informe um e-mail válido.";
    if (dg(f.tel).length < 10) e.tel = "Informe DDD e telefone.";
    if (!cpfOk(f.cpf)) e.cpf = "CPF inválido.";
    if (dg(f.cep).length !== 8) e.cep = "CEP deve ter 8 dígitos.";
    if (!f.rua.trim()) e.rua = "Informe a rua.";
    if (!f.num.trim()) e.num = "Informe o número.";
    if (!f.bairro.trim()) e.bairro = "Informe o bairro.";
    if (!f.cidade.trim()) e.cidade = "Informe a cidade.";
    if (f.uf.length !== 2) e.uf = "UF com 2 letras.";
  }
  if (step === 1 && metodo === "card") {
    if (!luhn(f.cnum)) e.cnum = "Número de cartão inválido.";
    if (f.cnome.trim().length < 3) e.cnome = "Informe o nome como está no cartão.";
    if (!expOk(f.cexp)) e.cexp = "Validade inválida ou vencida.";
    if (f.ccvv.length < 3) e.ccvv = "CVV com 3 ou 4 dígitos.";
  }
  return e;
};

/* ---------- componentes ---------- */
function Field({ label, err, cls = "", children }) {
  return (
    <label className={"f " + cls}>
      <span>{label}</span>
      {children}
      {err && <em role="alert">{err}</em>}
    </label>
  );
}

function Summary({ itens, setQty, cupom, aplicarCupom, calc }) {
  const [cod, setCod] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <aside className="card side">
      <h3 style={{ marginTop: 0 }}>Seu pedido</h3>
      {itens.map((i) => (
        <div className="it" key={i.id}>
          <div className="sw" style={{ background: i.c }} />
          <div className="n">{i.n}<small>{brl(i.p)}</small></div>
          <div className="q">
            <button aria-label={"Diminuir " + i.n} onClick={() => setQty(i.id, -1)}>−</button>
            <span>{i.q}</span>
            <button aria-label={"Aumentar " + i.n} onClick={() => setQty(i.id, 1)}>+</button>
          </div>
        </div>
      ))}
      {itens.length === 0 && <p className="hint">Seu carrinho está vazio.</p>}
      <div className="cp">
        <input placeholder="Cupom de desconto" aria-label="Cupom" value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} />
        <button onClick={() => setMsg(aplicarCupom(cod))}>Aplicar</button>
      </div>
      {msg && <div className="hint">{msg}</div>}
      <div style={{ marginTop: 12 }}>
        <div className="ln"><span>Subtotal</span><span>{brl(calc.sub)}</span></div>
        {calc.cupom > 0 && <div className="ln"><span>Cupom {cupom}</span><span className="d">− {brl(calc.cupom)}</span></div>}
        <div className="ln"><span>Frete</span><span>{calc.frete === 0 ? "Grátis" : brl(calc.frete)}</span></div>
        {calc.pix > 0 && <div className="ln"><span>Desconto Pix (5%)</span><span className="d">− {brl(calc.pix)}</span></div>}
        <div className="ln tot"><span>Total</span><span>{brl(calc.total)}</span></div>
      </div>
    </aside>
  );
}

function Sucesso({ pedido, form, calc, metodo, parcelas }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async (t) => {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {}
  };
  return (
    <div className="card">
      <div className="ok" aria-hidden="true">✓</div>
      <h2>{metodo === "card" ? "Pagamento aprovado" : "Pedido recebido"}</h2>
      <p>Pedido <b>#{pedido.id}</b>. Enviamos os detalhes para <b>{form.email}</b>.</p>
      {metodo === "pix" && (
        <div>
          <p>Pague com Pix copia e cola em até 30 minutos:</p>
          <div className="code">{pedido.codigo}</div>
          <button className="p" onClick={() => copiar(pedido.codigo)}>{copiado ? "Código copiado" : "Copiar código Pix"}</button>
        </div>
      )}
      {metodo === "boleto" && (
        <div>
          <p>Pague até <b>{pedido.venc}</b>. O pedido é liberado após a compensação (até 2 dias úteis).</p>
          <div className="code">{pedido.codigo}</div>
          <button className="p" onClick={() => copiar(pedido.codigo)}>{copiado ? "Linha copiada" : "Copiar linha digitável"}</button>
        </div>
      )}
      {metodo === "card" && <p>Cobrado em {parcelas}x de {brl(calc.total / parcelas)} no cartão final <b>{pedido.final}</b>.</p>}
      <h3>Entrega</h3>
      <dl>
        <dt>Endereço</dt>
        <dd>{form.rua}, {form.num}{form.comp ? " – " + form.comp : ""} · {form.bairro}, {form.cidade}/{form.uf} · {form.cep}</dd>
        <dt>Prazo</dt><dd>{pedido.prazo}</dd>
        <dt>Total</dt><dd>{brl(calc.total)}</dd>
      </dl>
      <p className="hint">Demonstração: nenhum pagamento real é processado e os códigos são fictícios.</p>
    </div>
  );
}

export default function Checkout() {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [itens, setItens] = useState(PRODUTOS.map((p, i) => ({ ...p, q: i === 2 ? 2 : 1 })));
  const [cupom, setCupom] = useState("");
  const [freteK, setFreteK] = useState("eco");
  const [metodo, setMetodo] = useState("pix");
  const [parcelas, setParcelas] = useState(1);
  const [busy, setBusy] = useState(false);
  const [falha, setFalha] = useState("");
  const [pedido, setPedido] = useState(null);
  const [f, setF] = useState({
    nome: "", email: "", tel: "", cpf: "", cep: "", rua: "", num: "", comp: "", bairro: "", cidade: "", uf: "",
    cnum: "", cnome: "", cexp: "", ccvv: "",
  });

  const errs = useMemo(() => validate(f, step, metodo), [f, step, metodo]);
  const e = (k) => (tried ? errs[k] : undefined);
  const bind = (k, m) => ({
    value: f[k],
    onChange: (ev) => setF((s) => ({ ...s, [k]: m ? m(ev.target.value) : ev.target.value })),
    "aria-invalid": !!(tried && errs[k]),
  });

  const calc = useMemo(() => {
    const sub = itens.reduce((s, i) => s + i.p * i.q, 0);
    const cup = sub * (CUPONS[cupom] || 0);
    const base = sub - cup;
    const frete = !itens.length ? 0 : sub >= FRETE_GRATIS && freteK === "eco" ? 0 : FRETES[freteK].p;
    const pix = metodo === "pix" ? base * 0.05 : 0;
    return { sub, cupom: cup, frete, pix, total: Math.max(base + frete - pix, 0) };
  }, [itens, cupom, freteK, metodo]);

  const setQty = (id, d) => setItens((l) => l.map((i) => (i.id === id ? { ...i, q: i.q + d } : i)).filter((i) => i.q > 0));
  const aplicarCupom = (c) => {
    if (CUPONS[c]) { setCupom(c); return "Cupom aplicado: " + CUPONS[c] * 100 + "% de desconto."; }
    setCupom("");
    return c ? "Cupom inválido. Tente MARE10." : "";
  };

  const avancar = () => {
    setTried(true);
    if (Object.keys(errs).length || !itens.length) return;
    setTried(false); setFalha(""); setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const voltar = () => { setTried(false); setStep((s) => s - 1); };

  /* Troque este setTimeout pela chamada ao seu backend / gateway de pagamento */
  const pagar = () => {
    setBusy(true); setFalha("");
    setTimeout(() => {
      if (metodo === "card" && f.ccvv === "000") {
        setBusy(false);
        setFalha("Cartão recusado pelo banco. Tente outro cartão ou pague com Pix.");
        return;
      }
      const venc = new Date(Date.now() + 3 * 864e5).toLocaleDateString("pt-BR");
      setPedido({
        id: rnd(6), venc, final: dg(f.cnum).slice(-4), prazo: FRETES[freteK].d,
        codigo: metodo === "pix"
          ? "00020126580014br.gov.bcb.pix0136" + rnd(8) + "-4f21-9c3b-" + rnd(12) + "5204000053039865406" + calc.total.toFixed(2) + "5802BR5913MARE CERAMICA6009ARACAJU62070503***6304" + rnd(4)
          : `${rnd(5)}.${rnd(5)} ${rnd(5)}.${rnd(6)} ${rnd(5)}.${rnd(6)} ${rnd(1)} ${rnd(14)}`,
      });
      setBusy(false);
    }, 1400);
  };

  const labelMetodo = {
    pix: "Pix",
    card: `Cartão de crédito · ${brand(f.cnum) || "cartão"} final ${dg(f.cnum).slice(-4)} · ${parcelas}x`,
    boleto: "Boleto bancário",
  }[metodo];

  const revisao = [
    ["Contato", `${f.nome} · ${f.email} · ${f.tel} · CPF ${f.cpf}`, 0],
    ["Entrega", `${f.rua}, ${f.num}${f.comp ? " – " + f.comp : ""} · ${f.bairro}, ${f.cidade}/${f.uf} · ${f.cep} · ${FRETES[freteK].n} (${FRETES[freteK].d})`, 0],
    ["Pagamento", labelMetodo, 1],
  ];

  return (
    <div className="wrap">
      <header>
        <div className="logo">Maré Cerâmica</div>
        <div className="lock">Compra segura</div>
      </header>
      <div className="grid">
        <main>
          {pedido ? (
            <Sucesso pedido={pedido} form={f} calc={calc} metodo={metodo} parcelas={parcelas} />
          ) : (
            <>
              <div className="steps" aria-label="Etapas">
                {["Entrega", "Pagamento", "Revisão"].map((t, i) => (
                  <div key={t} className={"st " + (i === step ? "on" : i < step ? "done" : "")}>
                    <b>{i < step ? "✓" : i + 1}</b>{t}
                  </div>
                ))}
              </div>
              <div className="card">
                {step === 0 && (
                  <div>
                    <h2>Contato e entrega</h2>
                    <div className="row">
                      <Field label="Nome completo" err={e("nome")}><input autoComplete="name" {...bind("nome")} /></Field>
                      <Field label="E-mail" cls="s3" err={e("email")}><input type="email" autoComplete="email" {...bind("email")} /></Field>
                      <Field label="Telefone" cls="s3" err={e("tel")}><input inputMode="tel" autoComplete="tel" placeholder="(79) 99999-0000" {...bind("tel", mask.tel)} /></Field>
                      <Field label="CPF" cls="s3" err={e("cpf")}><input inputMode="numeric" placeholder="000.000.000-00" {...bind("cpf", mask.cpf)} /></Field>
                      <Field label="CEP" cls="s3" err={e("cep")}><input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" {...bind("cep", mask.cep)} /></Field>
                      <Field label="Rua" cls="s4" err={e("rua")}><input autoComplete="address-line1" {...bind("rua")} /></Field>
                      <Field label="Número" cls="s2" err={e("num")}><input inputMode="numeric" {...bind("num")} /></Field>
                      <Field label="Complemento (opcional)" cls="s3"><input {...bind("comp")} /></Field>
                      <Field label="Bairro" cls="s3" err={e("bairro")}><input {...bind("bairro")} /></Field>
                      <Field label="Cidade" cls="s4" err={e("cidade")}><input autoComplete="address-level2" {...bind("cidade")} /></Field>
                      <Field label="UF" cls="s2" err={e("uf")}><input maxLength={2} {...bind("uf", mask.uf)} /></Field>
                    </div>
                    <h3>Forma de envio</h3>
                    <div className="opts">
                      {Object.entries(FRETES).map(([k, v]) => (
                        <label key={k} className={"opt " + (freteK === k ? "sel" : "")}>
                          <input type="radio" name="frete" checked={freteK === k} onChange={() => setFreteK(k)} />
                          <div className="t">
                            <span>{v.n}<small>{v.d}</small></span>
                            <span>{k === "eco" && calc.sub >= FRETE_GRATIS ? "Grátis" : brl(v.p)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <h2>Pagamento</h2>
                    <div className="tabs" role="tablist">
                      {[["pix", "Pix", "5% off"], ["card", "Cartão", "até 6x"], ["boleto", "Boleto", "3 dias"]].map(([k, t, s]) => (
                        <button key={k} role="tab" aria-selected={metodo === k} className={"tab " + (metodo === k ? "sel" : "")}
                          onClick={() => { setMetodo(k); setTried(false); }}>
                          {t}<small>{s}</small>
                        </button>
                      ))}
                    </div>
                    {metodo === "pix" && <div className="note">Você recebe o código Pix ao finalizar e tem 30 minutos para pagar. Desconto de 5% aplicado no total: <b>{brl(calc.total)}</b>.</div>}
                    {metodo === "boleto" && <div className="note">O boleto vence em 3 dias. O pedido só é separado após a compensação, que leva até 2 dias úteis.</div>}
                    {metodo === "card" && (
                      <>
                        <div className="row">
                          <Field label={"Número do cartão" + (brand(f.cnum) ? " · " + brand(f.cnum) : "")} err={e("cnum")}>
                            <input inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" {...bind("cnum", mask.card)} />
                          </Field>
                          <Field label="Nome impresso no cartão" err={e("cnome")}><input autoComplete="cc-name" {...bind("cnome")} /></Field>
                          <Field label="Validade" cls="s3" err={e("cexp")}><input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" {...bind("cexp", mask.exp)} /></Field>
                          <Field label="CVV" cls="s3" err={e("ccvv")}><input inputMode="numeric" autoComplete="cc-csc" placeholder="123" {...bind("ccvv", mask.cvv)} /></Field>
                          <Field label="Parcelamento">
                            <select value={parcelas} onChange={(ev) => setParcelas(+ev.target.value)}>
                              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}x de {brl(calc.total / n)} sem juros</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="hint">Demonstração: para simular uma recusa do banco, use o CVV 000.</div>
                      </>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <h2>Revise e confirme</h2>
                    {revisao.map(([t, v, s]) => (
                      <div key={t} style={{ marginBottom: 14 }}>
                        <div className="rv" style={{ marginTop: 0 }}><b>{t}</b><button onClick={() => setStep(s)}>Alterar</button></div>
                        <div style={{ color: "var(--mut)", fontSize: 14 }}>{v}</div>
                      </div>
                    ))}
                    {falha && <div className="err" role="alert">{falha}</div>}
                  </div>
                )}

                <div className="btns">
                  {step > 0 ? <button className="g" onClick={voltar} disabled={busy}>Voltar</button> : <span />}
                  {step < 2 ? (
                    <button className="p" onClick={avancar}>Continuar</button>
                  ) : (
                    <button className="p" onClick={pagar} disabled={busy || !itens.length}>{busy ? "Processando…" : "Pagar " + brl(calc.total)}</button>
                  )}
                </div>
                {tried && Object.keys(errs).length > 0 && <div className="err" role="alert">Corrija os campos destacados para continuar.</div>}
              </div>
            </>
          )}
        </main>
        <Summary itens={itens} setQty={setQty} cupom={cupom} aplicarCupom={aplicarCupom} calc={calc} />
      </div>
    </div>
  );
}