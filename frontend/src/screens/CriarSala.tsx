import { useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { criarSala } from "../client/colyseusClient.ts";
import "./CriarSala.css";

const MIN_JOGADORES = 2;
const MAX_JOGADORES = 4;

interface CriarSalaProps {
  onSalaCriada: (room: Room) => void;
  onAbrirFAQ: () => void;
  mostrarFAQ: boolean;
}

/**
 * Criar Sala -- primeira tela real do jogo (Story 1.2). Host informa o
 * nome, o total de Jogadores (2-4) e quantos sao IA; ao confirmar, dispara
 * o intent `criarSala` (AD-1) e entrega o `Room` criado pro chamador (que
 * navega pra Sala de Espera). Visual conforme `mockups/key-criar-sala.html`.
 *
 * `onAbrirFAQ` (Story 4.1): dispara o toggle de `App.tsx` que troca essa
 * tela pela `FAQ` -- o botao `faq-link` ja existia estatico desde a Story
 * 1.2 (herdado do mockup), so virou interativo agora que a FAQ existe.
 *
 * `mostrarFAQ` (achado do code review, gerenciamento de foco): so usado
 * pelo `useEffect` abaixo, pra devolver o foco ao botao "Como funciona?"
 * assim que a FAQ fecha (transicao true -> false) -- sem isso, `FAQ`
 * desmonta (removendo o elemento focado ate entao) e o navegador reseta o
 * foco pro `<body>`, perdendo a posicao de quem navega por teclado/leitor
 * de tela. Vive aqui (nao em `App.tsx`) porque `CriarSala` nunca desmonta
 * (so fica escondida via CSS), entao o `ref` do botao sobrevive ao ciclo
 * inteiro de abrir/fechar a FAQ.
 */
export function CriarSala({ onSalaCriada, onAbrirFAQ, mostrarFAQ }: CriarSalaProps) {
  const [nome, setNome] = useState("");
  const [totalJogadores, setTotalJogadores] = useState(MAX_JOGADORES);
  const [totalIA, setTotalIA] = useState(0);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const botaoFAQRef = useRef<HTMLButtonElement>(null);
  const mostrarFAQAnteriorRef = useRef(mostrarFAQ);

  useEffect(() => {
    if (mostrarFAQAnteriorRef.current && !mostrarFAQ) {
      botaoFAQRef.current?.focus();
    }
    mostrarFAQAnteriorRef.current = mostrarFAQ;
  }, [mostrarFAQ]);

  const nomeValido = nome.trim().length > 0;

  function ajustarTotalJogadores(delta: number) {
    setTotalJogadores((atual) => {
      const proximo = Math.min(MAX_JOGADORES, Math.max(MIN_JOGADORES, atual + delta));
      // Nunca deixa totalIA sem ao menos 1 vaga humana sobrando pro host.
      setTotalIA((ia) => Math.min(ia, proximo - 1));
      return proximo;
    });
  }

  function ajustarTotalIA(delta: number) {
    setTotalIA((atual) => Math.min(totalJogadores - 1, Math.max(0, atual + delta)));
  }

  async function handleCriarSala() {
    if (!nomeValido || criando) return;

    setCriando(true);
    setErro(null);

    try {
      const room = await criarSala(nome.trim(), totalJogadores, totalIA);
      onSalaCriada(room);
    } catch (erroCriacao) {
      console.error("[frontend] falha ao criar sala", erroCriacao);
      setErro("Não foi possível criar a sala. Tente novamente.");
      setCriando(false);
    }
  }

  return (
    <div className="criar-sala">
      <h1 className="wordmark">Super Trunfo</h1>
      <button type="button" className="faq-link" onClick={onAbrirFAQ} ref={botaoFAQRef}>
        Como funciona? Ver FAQ de regras
      </button>

      <form
        className="card"
        onSubmit={(evento) => {
          evento.preventDefault();
          handleCriarSala();
        }}
      >
        <div className="campo">
          <label htmlFor="nome-host">Seu nome</label>
          <input
            id="nome-host"
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Digite seu nome"
          />
        </div>

        <div className="campo">
          <span className="rotulo">Total de jogadores (2–4)</span>
          <div className="stepper">
            <button
              type="button"
              onClick={() => ajustarTotalJogadores(-1)}
              disabled={totalJogadores <= MIN_JOGADORES}
              aria-label="Diminuir total de jogadores"
            >
              –
            </button>
            <span className="valor" data-testid="total-jogadores">
              {totalJogadores}
            </span>
            <button
              type="button"
              onClick={() => ajustarTotalJogadores(1)}
              disabled={totalJogadores >= MAX_JOGADORES}
              aria-label="Aumentar total de jogadores"
            >
              +
            </button>
          </div>
        </div>

        <div className="campo">
          <span className="rotulo">Quantos são IA</span>
          <div className="stepper">
            <button
              type="button"
              onClick={() => ajustarTotalIA(-1)}
              disabled={totalIA <= 0}
              aria-label="Diminuir quantidade de IA"
            >
              –
            </button>
            <span className="valor" data-testid="total-ia">
              {totalIA}
            </span>
            <button
              type="button"
              onClick={() => ajustarTotalIA(1)}
              disabled={totalIA >= totalJogadores - 1}
              aria-label="Aumentar quantidade de IA"
            >
              +
            </button>
          </div>
          <p className="dica">Vagas humanas não preenchidas até você iniciar também viram IA.</p>
        </div>

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-primario" disabled={!nomeValido || criando}>
          {criando ? "Criando…" : "Criar Sala"}
        </button>
      </form>
    </div>
  );
}
