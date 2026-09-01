import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';

// React StrictMode intentionally mounts, destroys, and mounts effects again in
// development. Recreating a WebGL renderer during that diagnostic cycle was
// forcing a context loss and leaving the cached skinned GLB blank.
createRoot(document.getElementById('root')).render(<App />);
