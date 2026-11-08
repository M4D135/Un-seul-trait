import {createRoot} from 'react-dom/client';
import Home from '../../app/page';
import '../../app/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Le point de montage du jeu est absent.');
createRoot(root).render(<Home />);
