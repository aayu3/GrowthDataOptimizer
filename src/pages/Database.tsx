
import { Link } from 'react-router-dom';
import { RelicDatabaseViewer } from '../components/RelicDatabaseViewer';

export function Database() {
    return (
        <div className="app-container">
            <header className="header-glow">
                <h1>GF2 <span>Relic Optimizer</span></h1>
                <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <Link to="/" className="back-btn" style={{ position: 'relative', textDecoration: 'none' }}>
                        Go to Optimizer
                    </Link>
                </div>
            </header>
            <main className="main-content">
                <RelicDatabaseViewer />
            </main>
        </div>
    );
}
