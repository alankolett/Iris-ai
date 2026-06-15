import { app, BrowserWindow, Tray, Menu } from 'electron';
import { join } from 'path';

export class WindowManager {
  private window: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;

  public createWindow(): void {
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      backgroundColor: '#0D1117',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    if (process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.window.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hide();
      }
    });

    this.createTray();
  }

  private createTray(): void {
    if (this.tray) return;
    
    // In production, you would point this to an actual icon file.
    // For now we create a NativeImage or use a placeholder approach if an icon isn't available.
    // Assuming resources/icon.ico is or will be present. 
    // Using a blank/empty image to prevent crash if icon is missing during dev.
    import('electron').then(({ nativeImage }) => {
        const icon = nativeImage.createEmpty();
        this.tray = new Tray(icon);
        this.tray.setToolTip('IRIS AI');

        const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => this.show() },
        { label: 'Quit', click: () => {
            this.isQuitting = true;
            app.quit();
        }}
        ]);
        
        this.tray.setContextMenu(contextMenu);
        this.tray.on('double-click', () => this.show());
    });
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public show(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
    }
  }

  public hide(): void {
    if (this.window) {
      this.window.hide();
    }
  }

  public destroy(): void {
    this.isQuitting = true;
    if (this.window) {
      this.window.destroy();
    }
    if (this.tray) {
      this.tray.destroy();
    }
  }
}
