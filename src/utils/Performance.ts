export interface PerformanceMeasure {
    name: string;
    start: [number, number];
    dur: number;
}

export class PerformanceMeasurer {
    protected measures = new Map<string, PerformanceMeasure>();

    measureStart(name: string) {
        let measure = this.measures.get(name);
        if (!measure) {
            measure = {
                name, start: null, dur: 0
            };
            this.measures.set(name, measure);
        }
        measure.start = process.hrtime();
    }

    measureEnd(name: string) {
        const m = this.measures.get(name);
        const diff = process.hrtime(m.start);
        m.dur += diff[0] * 1000 + diff[1] / 1e6;
        return m.dur;
    }

    getAllMeasures() {
        return [...this.measures.values()];
    }

    getMeasure(name: string) {
        return this.measures.get(name);
    }
}