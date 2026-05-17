import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { FormationEquippedStateProvider } from '../contexts/EquippedStateContext';
import { Optimizer } from './Optimizer';

export function FormationOptimizerPage() {
    const { formationId } = useParams<{ formationId: string }>();
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const formation = useLiveQuery(() => db.formations.get(formationId!), [formationId]);

    if (formation === undefined) {
        return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    }

    if (formation === null || !formationId) {
        return (
            <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <p>Formation not found.</p>
                <Link to="/characters" className="back-btn">← Back to Characters</Link>
            </div>
        );
    }

    return (
        <FormationEquippedStateProvider formation={formation} relics={relics}>
            <Optimizer formationName={formation.name} />
        </FormationEquippedStateProvider>
    );
}
