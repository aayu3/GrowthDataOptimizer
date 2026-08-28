import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { GeneralEquippedStateProvider } from '../contexts/EquippedStateContext';
import { Optimizer } from './Optimizer';

export function GeneralOptimizerPage() {
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];

    return (
        <GeneralEquippedStateProvider relics={relics}>
            <Optimizer />
        </GeneralEquippedStateProvider>
    );
}
