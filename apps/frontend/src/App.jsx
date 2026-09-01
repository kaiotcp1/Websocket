import { useEffect, useRef, useState } from 'react';

const defaultUrl = 'wss://vwiohnml18.execute-api.us-east-1.amazonaws.com/dev';
const choices = [{ value: 'rock', label: 'Pedra', icon: '✊' }, { value: 'paper', label: 'Papel', icon: '✋' }, { value: 'scissors', label: 'Tesoura', icon: '✌️' }];
const labels = { rock: 'pedra', paper: 'papel', scissors: 'tesoura' };

export default function App() {
  const socketRef = useRef();
  const [url, setUrl] = useState(() => localStorage.getItem('websocket-url') || defaultUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState();
  const [feedback, setFeedback] = useState('');
  useEffect(() => () => socketRef.current?.close(), []);
  function send(message) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) { setFeedback('Conecte-se antes de enviar uma ação.'); return; }
    socketRef.current.send(JSON.stringify(message));
  }
  function connect() {
    if (socketRef.current?.readyState === WebSocket.OPEN) { socketRef.current.close(); return; }
    if (!url.startsWith('wss://')) { setFeedback('A URL precisa começar com wss://.'); return; }
    localStorage.setItem('websocket-url', url); setFeedback('Conectando…');
    const socket = new WebSocket(url); socketRef.current = socket;
    socket.addEventListener('open', () => { setConnected(true); setFeedback('Conexão estabelecida.'); });
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('error', () => setFeedback('Não foi possível conectar. Confira a URL e o deploy.'));
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === 'error') setFeedback(message.message);
      if (message.type === 'roomState') { setFeedback(''); setRoom(message.room); }
    });
  }
  const canPlay = room?.status === 'active' && !room.youHavePlayed;
  const gameStatus = room?.status === 'waiting' ? 'Compartilhe o código e aguarde o segundo jogador.' : room?.status === 'active' ? room.youHavePlayed ? 'Sua escolha está guardada. Aguardando oponente…' : 'Escolha pedra, papel ou tesoura.' : room?.status === 'abandoned' ? 'O outro jogador desconectou. Crie uma nova sala para recomeçar.' : room?.status === 'finished' ? `Você: ${labels[room.yourChoice] ?? '—'} · Oponente: ${labels[room.opponentChoice] ?? '—'}` : '';
  const result = room?.status === 'finished' ? room.winner === 'draw' ? 'Empate!' : room.winner === room.youAre ? 'Você venceu!' : 'Você perdeu.' : '';
  return <main className="grid min-h-screen place-items-center bg-midnight p-6 font-sans text-slate-100"><div className="w-full max-w-2xl rounded-3xl border border-sky-300/30 bg-slate-950/55 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
    <header className="mb-6 text-center"><p className="text-xs font-bold tracking-[0.15em] text-sky-200">WEBSOCKET · API GATEWAY · LAMBDA · DYNAMODB</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pedra, Papel e Tesoura</h1><p className={`mt-2 font-semibold ${connected ? 'text-emerald-300' : 'text-amber-200'}`}>{connected ? '● Conectado' : '○ Desconectado'}</p></header>
    <section className="rounded-2xl border border-slate-600/60 bg-panel p-5"><label className="mb-2 block text-sm font-medium" htmlFor="websocket-url">URL do WebSocket</label><div className="flex flex-col gap-2 sm:flex-row"><input id="websocket-url" className="min-w-0 flex-1 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2.5 font-mono text-sm outline-none focus:border-sky" value={url} onChange={(event) => setUrl(event.target.value)} /><button className="rounded-lg bg-sky px-4 py-2.5 font-extrabold text-slate-950 transition hover:bg-sky-300" onClick={connect}>{connected ? 'Desconectar' : 'Conectar'}</button></div></section>
    {!room && <section className="mt-4 rounded-2xl border border-slate-600/60 bg-panel p-5"><h2 className="text-xl font-bold">Sala</h2><button className="mt-3 w-full rounded-lg bg-mint px-4 py-3 font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40" disabled={!connected} onClick={() => send({ action: 'createRoom' })}>Criar sala</button><p className="my-3 text-center text-sm text-slate-400">ou</p><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); send({ action: 'joinRoom', roomCode }); }}><input className="min-w-0 flex-1 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2.5 text-center font-mono uppercase tracking-[0.2em] outline-none focus:border-sky" maxLength="6" placeholder="CÓDIGO" value={roomCode} disabled={!connected} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /><button className="rounded-lg bg-sky px-4 py-2.5 font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40" disabled={!connected}>Entrar</button></form></section>}
    {room && <section className="mt-4 rounded-2xl border border-slate-600/60 bg-panel p-5 text-center" aria-live="polite"><p className="text-sky-200">Sala <strong className="font-mono tracking-widest">{room.code}</strong></p><p className="mt-3 min-h-6 text-slate-200">{gameStatus}</p><div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">{choices.map((choice) => <button key={choice.value} disabled={!canPlay} onClick={() => send({ action: 'play', choice: choice.value })} className="grid min-h-24 place-items-center rounded-xl bg-mint p-2 font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"><span className="text-3xl">{choice.icon}</span><span>{choice.label}</span></button>)}</div><p className="mt-4 min-h-6 text-lg font-black text-amber-200">{result}</p></section>}
    <p className="mt-4 min-h-6 text-center text-sm font-medium text-amber-100" role="alert">{feedback}</p>
  </div></main>;
}
