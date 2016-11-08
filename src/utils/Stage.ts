import {SourceFile} from "./SourceFile";
export class Stage {
    private items = new Set<SourceFile>();

    addFile(file: SourceFile) {
        this.items.add(file);
    }

    remove(file: SourceFile) {
        this.items.delete(file);
    }

    list() {
        return [...this.items.values()];
    }
}