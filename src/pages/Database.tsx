
import { Link } from 'react-router-dom';
import { RelicDatabaseViewer } from '../components/RelicDatabaseViewer';

export function Database() {
    return (
        <div className="app-container">
            <header className="header-glow">
                <h1>GFL2 <span>Growth Data Optimizer</span></h1>
                <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <Link to="/characters" className="back-btn" style={{ position: 'relative', textDecoration: 'none' }}>
                        Optimize Dolls
                    </Link>
                </div>
            </header>
            <main className="main-content">
                <RelicDatabaseViewer />
            </main>
        </div>
    );
}
