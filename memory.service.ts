import { connect } from "@lancedb/lancedb";
import { app } from "electron";
import { join } from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

export class MemoryService {
  private db: any;
  private embedder: any;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const dbPath = join(app.getPath("userData"), "iris-memory");
    this.db = await connect(dbPath);
    
    // Create tables if they don't exist by catching the error when opening
    try { await this.db.openTable("memories"); } 
    catch { await this.db.createTable("memories", [{ id: "init", key: "init", value: "init", timestamp: Date.now(), vector: Array(384).fill(0) }]); }
    
    try { await this.db.openTable("notes"); } 
    catch { await this.db.createTable("notes", [{ id: "init", title: "init", content: "init", created: Date.now(), vector: Array(384).fill(0) }]); }

    try { await this.db.openTable("codebase"); } 
    catch { await this.db.createTable("codebase", [{ id: "init", filePath: "init", chunk: "init", vector: Array(384).fill(0) }]); }

    this.initialized = true;
  }

  private async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      // Dynamically import the pipeline to bypass the ESM clash
      // Use eval to prevent electron-vite from transpiling this to require()
      const { pipeline } = await eval('import("@xenova/transformers")');
      this.embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    const out = await this.embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data) as number[];
  }

  async saveMemory(key: string, value: string): Promise<void> {
    await this.init();
    const vec = await this.embed(key + ":" + value);
    const table = await this.db.openTable("memories");
    await table.add([{ id: uuid(), key, value, timestamp: Date.now(), vector: vec }]);
  }

  async getMemory(query?: string): Promise<any[]> {
    await this.init();
    const table = await this.db.openTable("memories");
    if (query) {
      const vec = await this.embed(query);
      return await table.search(vec).limit(8).toArray();
    } else {
      return await table.filter("timestamp > 0").limit(20).toArray();
    }
  }

  async saveNote(title: string, content: string): Promise<string> {
    await this.init();
    const vec = await this.embed(title + "\n" + content);
    const table = await this.db.openTable("notes");
    await table.add([{ id: uuid(), title, content, created: Date.now(), vector: vec }]);
    
    const notesDir = join(app.getPath("documents"), "IRIS Notes");
    fs.mkdirSync(notesDir, { recursive: true });
    const filePath = join(notesDir, `${title}.md`);
    fs.writeFileSync(filePath, `# ${title}\n\n${content}`);
    return filePath;
  }

  async getNotes(): Promise<any[]> {
    const notesDir = join(app.getPath("documents"), "IRIS Notes");
    if (!fs.existsSync(notesDir)) return [];
    
    const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
    return files.map(f => {
      const filePath = join(notesDir, f);
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      return { title: f.replace('.md', ''), preview: content.substring(0, 150), path: filePath, created: stats.mtimeMs };
    });
  }

  async indexFolder(rootPath: string): Promise<number> {
    await this.init();
    let count = 0;
    const table = await this.db.openTable("codebase");
    
    const walk = async (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (['node_modules', '.git', 'out', 'build'].includes(file)) continue;
        const fullPath = join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          await walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx|py|go|md|txt)$/.test(file) && fs.statSync(fullPath).size < 100000) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const chunks = content.match(/[\s\S]{1,600}/g) || [];
          for (const chunk of chunks) {
            const vec = await this.embed(chunk);
            await table.add([{ id: uuid(), filePath: fullPath, chunk, vector: vec }]);
          }
          count++;
        }
      }
    };
    await walk(rootPath);
    return count;
  }

  async askOracle(question: string): Promise<{ answer: string, sources: string[] }> {
    await this.init();
    try {
      const table = await this.db.openTable("codebase");
      const vec = await this.embed(question);
      const results = await table.search(vec).limit(6).toArray();
      const context = results.map((r: any) => `FILE: ${r.filePath}\n${r.chunk}`).join('\n\n');
      const sources = [...new Set(results.map((r: any) => r.filePath))] as string[];
      return { answer: context, sources };
    } catch {
      return { answer: "No codebase indexed yet.", sources: [] };
    }
  }
}
