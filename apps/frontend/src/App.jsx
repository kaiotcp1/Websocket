import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useHandTracking } from './hooks/useHandTracking.js';

const ChoiceScene = lazy(() => import('./components/ChoiceScene.jsx'));

const defaultUrl = 'wss://vwiohnml18.execute-api.us-east-1.amazonaws.com/dev';
const labels = { rock: 'Pedra', paper: 'Papel', scissors: 'Tesoura' };

export default function App() {
  const socketRef = useRef();
  const [url, setUrl] = useState(() => localStorage.getItem('websocket-url') || defaultUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState();
  const remoteHandRef = useRef();
  const [feedback, setFeedback] = useState('');

  const handTracking = useHandTracking(({ screenLandmarks, worldLandmarks, handedness }) => {
    if (room?.status === 'active') send({ action: 'handMotion', landmarks: screenLandmarks, worldLandmarks, handedness });
  });

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
    remoteHandRef.current = undefined;
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
      }
      if (message.type === 'handMotion') {
        remoteHandRef.current = {
          screenLandmarks: message.landmarks,
          // Compatibility with the deployed backend while it is still on the
          // previous protocol: screen points remain a usable fallback.
          worldLandmarks: message.worldLandmarks ?? message.landmarks,
          handedness: message.handedness,
        };
      }
    });
  }

  function choose(choice) {
    send({ action: 'play', choice });
  }

  const canPlay = room?.status === 'active' && !room.youHavePlayed;
  const yourChoice = room?.status === 'finished' ? room.yourChoice : undefined;
  const opponentChoice = room?.status === 'finished' ? room.opponentChoice : undefined;

  useEffect(() => {
    if (!canPlay || !handTracking.gesture) return undefined;

    // Requiring a short stable pose avoids submitting a transient gesture while
    // the player is still positioning the hand in front of the camera.
    setFeedback(`Gesto ${labels[handTracking.gesture]} reconhecido. Mantendo para jogar…`);
    const timer = window.setTimeout(() => choose(handTracking.gesture), 850);
    return () => window.clearTimeout(timer);
  }, [canPlay, handTracking.gesture]);

  const gameStatus = room?.status === 'waiting'
    ? 'Compartilhe o código e aguarde o segundo jogador.'
    : room?.status === 'active'
      ? room.youHavePlayed ? 'Seu gesto está guardado. Aguardando oponente…' : 'Mostre pedra, papel ou tesoura para a webcam.'
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
      <div className="steam-card w-full max-w-4xl rounded-2xl border border-steam-blue/25 p-6 shadow-2xl shadow-black/55 backdrop-blur sm:p-8">
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
            <Suspense fallback={<div className="grid h-[26rem] place-items-center rounded-xl border border-steam-blue/25 bg-steam-deep/80 text-steam-blue sm:h-[30rem]">Carregando arena 3D…</div>}>
              <ChoiceScene localHandRef={handTracking.landmarksRef} remoteHandRef={remoteHandRef} result={result} />
            </Suspense>
          </div>
          <section className="mt-3 rounded-sm border border-steam-blue/20 bg-steam-deep/55 p-3 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-black text-steam-blue">Mão pela webcam</p><p className="text-xs text-slate-300">O vídeo permanece neste dispositivo; apenas pontos da mão são enviados ao oponente.</p></div>
              <button className="steam-button rounded-sm bg-steam-surface px-3 py-2 text-sm font-bold text-slate-100" onClick={handTracking.enabled ? handTracking.stopTracking : handTracking.startTracking}>
                {handTracking.enabled ? 'Desativar câmera' : 'Ativar câmera'}
              </button>
            </div>
            <div className={`mt-3 items-center gap-3 ${handTracking.enabled ? 'flex' : 'hidden'}`}><video ref={handTracking.videoRef} className="h-20 w-28 rounded-sm border border-steam-blue/25 object-cover [-webkit-transform:scaleX(-1)]" muted playsInline /><p className="text-sm text-slate-200">Gesto detectado: <strong className="text-steam-green-light">{handTracking.gesture ? labels[handTracking.gesture] : 'posicione a mão'}</strong></p></div>
            {handTracking.error && <p className="mt-2 text-sm text-red-300">{handTracking.error}</p>}
          </section>
          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-sm">
            <ChoiceFeedback title="Você" choice={yourChoice} revealed={room.status === 'finished'} pending={handTracking.gesture ? `Gesto: ${labels[handTracking.gesture]}` : 'Posicione a mão'} />
            <ChoiceFeedback title="Oponente" choice={opponentChoice} revealed={room.status === 'finished'} />
          </div>
          <p className={`mt-4 min-h-6 text-xl font-black text-steam-blue ${result ? 'result-reveal' : ''}`}>{result}</p>
        </section>}

        <p className="mt-4 min-h-6 text-center text-sm font-medium text-amber-100" role="alert">{feedback}</p>
      </div>
    </main>
  );
}

function ChoiceFeedback({ title, choice, revealed, pending = 'Aguardando…' }) {
  return <div className="rounded-sm border border-steam-blue/20 bg-steam-deep/55 p-3 transition-colors duration-300 hover:border-steam-blue/45">
    <p className="text-xs font-bold tracking-wider text-steam-blue">{title.toUpperCase()}</p>
    <p className="mt-1 font-black text-slate-100">{revealed && choice ? labels[choice] : pending}</p>
  </div>;
}
