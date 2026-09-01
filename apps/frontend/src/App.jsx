import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const ChoiceScene = lazy(() => import('./components/ChoiceScene.jsx'));

const defaultUrl = 'wss://vwiohnml18.execute-api.us-east-1.amazonaws.com/dev';
const choices = [
  { value: 'rock', label: 'Pedra' },
  { value: 'paper', label: 'Papel' },
  { value: 'scissors', label: 'Tesoura' },
];
const labels = { rock: 'Pedra', paper: 'Papel', scissors: 'Tesoura' };

export default function App() {
  const socketRef = useRef();
  const [url, setUrl] = useState(() => localStorage.getItem('websocket-url') || defaultUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState();
  const [selectedChoice, setSelectedChoice] = useState();
  const [feedback, setFeedback] = useState('');

  useEffect(() => () => socketRef.current?.close(), []);

  function send(message) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setFeedback('Conecte-se antes de enviar uma ação.');
      return;
    }
    socketRef.current.send(JSON.stringify(message));
  }

  function connect() {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.close();
      return;
    }
    if (!url.startsWith('wss://')) {
      setFeedback('A URL precisa começar com wss://.');
      return;
    }

    localStorage.setItem('websocket-url', url);
    setRoom(undefined);
    setSelectedChoice(undefined);
    setFeedback('Conectando…');
    const socket = new WebSocket(url);
    socketRef.current = socket;
    socket.addEventListener('open', () => { setConnected(true); setFeedback('Conexão estabelecida.'); });
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('error', () => setFeedback('Não foi possível conectar. Confira a URL e o deploy.'));
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === 'error') setFeedback(message.message);
      if (message.type === 'roomState') {
        setFeedback('');
        setRoom(message.room);
        if (message.room.status === 'finished') setSelectedChoice(message.room.yourChoice);
      }
    });
  }

  function choose(choice) {
    // Keeping the local selection lets the 3D view react immediately while the
    // backend keeps the opponent's choice private until the round is finished.
    setSelectedChoice(choice);
    send({ action: 'play', choice });
  }

  const canPlay = room?.status === 'active' && !room.youHavePlayed;
  const yourChoice = room?.status === 'finished' ? room.yourChoice : selectedChoice;
  const opponentChoice = room?.status === 'finished' ? room.opponentChoice : undefined;
  const gameStatus = room?.status === 'waiting'
    ? 'Compartilhe o código e aguarde o segundo jogador.'
    : room?.status === 'active'
      ? room.youHavePlayed ? 'Sua escolha está guardada. Aguardando oponente…' : 'Escolha pedra, papel ou tesoura.'
      : room?.status === 'abandoned'
        ? 'O outro jogador desconectou. Crie uma nova sala para recomeçar.'
        : room?.status === 'finished'
          ? 'As escolhas foram reveladas.'
          : '';
  const result = room?.status === 'finished'
    // Older deployments omitted winner for a draw. Keep the client correct while
    // that version is being replaced, and use the explicit draw value afterwards.
    ? !room.winner || room.winner === 'draw' ? 'Empate!' : room.winner === room.youAre ? 'Você venceu!' : 'Você perdeu.'
    : '';

  return (
    <main className="grid min-h-screen place-items-center bg-steam-deep p-6 font-sans text-slate-100">
      <div className="steam-card w-full max-w-2xl rounded-2xl border border-steam-blue/25 p-6 shadow-2xl shadow-black/55 backdrop-blur sm:p-8">
        <header className="mb-6 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-steam-blue">WEBSOCKET · API GATEWAY · LAMBDA · DYNAMODB</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pedra, Papel e Tesoura</h1>
          <p className={`mt-2 font-semibold ${connected ? 'text-steam-green-light' : 'text-slate-300'}`}>
            {connected ? '● Conectado' : '○ Desconectado'}
          </p>
        </header>

        <section className="steam-panel rounded-xl border border-steam-blue/20 p-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="websocket-url">URL do WebSocket</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="websocket-url" className="min-w-0 flex-1 rounded-sm border border-steam-blue/35 bg-steam-deep px-3 py-2.5 font-mono text-sm outline-none transition focus:border-steam-blue focus:ring-2 focus:ring-steam-blue/20" value={url} onChange={(event) => setUrl(event.target.value)} />
            <button className="steam-button rounded-sm bg-steam-blue px-4 py-2.5 font-extrabold text-steam-deep" onClick={connect}>
              {connected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>
        </section>

        {!room && <section className="steam-panel screen-enter mt-4 rounded-xl border border-steam-blue/20 p-5">
          <h2 className="text-xl font-bold">Sala</h2>
          <button className="steam-button mt-3 w-full rounded-sm bg-steam-green px-4 py-3 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!connected} onClick={() => send({ action: 'createRoom' })}>Criar sala</button>
          <p className="my-3 text-center text-sm text-slate-400">ou</p>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); send({ action: 'joinRoom', roomCode }); }}>
            <input className="min-w-0 flex-1 rounded-sm border border-steam-blue/35 bg-steam-deep px-3 py-2.5 text-center font-mono uppercase tracking-[0.2em] outline-none transition focus:border-steam-blue focus:ring-2 focus:ring-steam-blue/20" maxLength="6" placeholder="CÓDIGO" value={roomCode} disabled={!connected} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
            <button className="steam-button rounded-sm bg-steam-blue px-4 py-2.5 font-extrabold text-steam-deep disabled:cursor-not-allowed disabled:opacity-40" disabled={!connected}>Entrar</button>
          </form>
        </section>}

        {room && <section className="steam-panel screen-enter mt-4 rounded-xl border border-steam-blue/20 p-5 text-center" aria-live="polite">
          <p className="text-steam-blue">Sala <strong className="font-mono tracking-widest">{room.code}</strong></p>
          <p className="mt-3 min-h-6 text-slate-200">{gameStatus}</p>
          <div className="mt-4">
            <Suspense fallback={<div className="grid h-72 place-items-center rounded-xl border border-steam-blue/25 bg-steam-deep/80 text-steam-blue">Carregando arena 3D…</div>}>
              <ChoiceScene yourChoice={yourChoice} opponentChoice={opponentChoice} winner={room.winner} youAre={room.youAre} />
            </Suspense>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-sm">
            <ChoiceFeedback title="Você" choice={yourChoice} revealed />
            <ChoiceFeedback title="Oponente" choice={opponentChoice} revealed={room.status === 'finished'} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {choices.map((choice) => <button key={choice.value} disabled={!canPlay} onClick={() => choose(choice.value)} className={`steam-button min-h-16 rounded-sm border p-2 font-extrabold disabled:cursor-not-allowed disabled:opacity-40 ${selectedChoice === choice.value ? 'border-steam-blue bg-steam-blue text-steam-deep shadow-lg shadow-steam-blue/25' : 'border-steam-blue/25 bg-steam-surface text-slate-100 hover:bg-steam-blue hover:text-steam-deep'}`}>{choice.label}</button>)}
          </div>
          <p className={`mt-4 min-h-6 text-xl font-black text-steam-blue ${result ? 'result-reveal' : ''}`}>{result}</p>
        </section>}

        <p className="mt-4 min-h-6 text-center text-sm font-medium text-amber-100" role="alert">{feedback}</p>
      </div>
    </main>
  );
}

function ChoiceFeedback({ title, choice, revealed }) {
  return <div className="rounded-sm border border-steam-blue/20 bg-steam-deep/55 p-3 transition-colors duration-300 hover:border-steam-blue/45">
    <p className="text-xs font-bold tracking-wider text-steam-blue">{title.toUpperCase()}</p>
    <p className="mt-1 font-black text-slate-100">{revealed && choice ? labels[choice] : 'Aguardando…'}</p>
  </div>;
}
