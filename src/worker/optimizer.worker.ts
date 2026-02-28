import { RelicSolver } from '../optimizer/solver';
import { Relic, OptimizerConstraints, SkillDefinition } from '../optimizer/types';

self.onmessage = (e: MessageEvent) => {
    const { relics, constraints, skillsData, relicInfo } = e.data as {
        relics: Relic[];
        constraints: OptimizerConstraints;
        skillsData: Record<string, SkillDefinition>;
        relicInfo: any;
    };

    try {
        const solver = new RelicSolver(relics, constraints, skillsData, relicInfo);
        const results = solver.solve();
        self.postMessage({ type: 'DONE', results });
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', message: error.message });
    }
};
