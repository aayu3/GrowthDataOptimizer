import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import './index.css';

const Landing = lazy(() => import('./pages/Landing').then((module) => ({ default: module.Landing })));
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Database = lazy(() => import('./pages/Database').then((module) => ({ default: module.Database })));
const Optimizer = lazy(() => import('./pages/Optimizer').then((module) => ({ default: module.Optimizer })));

function App() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', height: '100vh', width: '100vw', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/characters" element={<Home />} />
                <Route path="/database" element={<Database />} />
                <Route path="/doll/:dollName" element={<Optimizer />} />
            </Routes>
        </Suspense>
    );
}

export default App;
