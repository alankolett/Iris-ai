import { BrowserWindow } from 'electron';
import { registerSystemHandlers } from './handlers/system';
import { registerFileHandlers } from './handlers/file';
import { registerTerminalHandlers } from './handlers/terminal';
import { registerAutomationHandlers } from './handlers/automation';
import { registerWidgetHandlers } from './handlers/widget';
import { registerWebHandlers } from './handlers/web';
import { registerAiHandlers } from './handlers/ai';
import { registerMemoryHandlers } from './handlers/memory';

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  registerSystemHandlers(mainWindow);
  registerFileHandlers();
  registerTerminalHandlers();
  registerAutomationHandlers();
  registerWidgetHandlers();
  registerWebHandlers();
  registerAiHandlers(mainWindow);
  registerMemoryHandlers();
}
