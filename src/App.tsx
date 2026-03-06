import { Routes, Route } from 'react-router-dom';
import './index.css';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Database } from './pages/Database';
import { Optimizer } from './pages/Optimizer';

function App() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/characters" element={<Home />} />
            <Route path="/database" element={<Database />} />
            <Route path="/doll/:dollName" element={<Optimizer />} />
        </Routes>
    );
}

export default App;
