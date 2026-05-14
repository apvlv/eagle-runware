export {};

declare global {
  interface EagleLog {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  }

  interface EagleFolder {
    id: string;
    name: string;
    children?: EagleFolder[];
    description?: string;
    modificationTime?: number;
    tags?: string[];
    password?: string;
    passwordTips?: string;
    iconColor?: string;
    [key: string]: unknown;
  }

  interface EagleFolderAPI {
    getAll: () => Promise<EagleFolder[]>;
    getSelected?: () => Promise<EagleFolder[]>;
    getById?: (id: string) => Promise<EagleFolder | undefined>;
    create?: (input: { name: string; parent?: string }) => Promise<EagleFolder>;
  }

  interface EagleItem {
    id: string;
    name: string;
    ext: string;
    filePath: string;
    fileURL?: string;
    thumbnailPath?: string;
    thumbnailURL?: string;
    width?: number;
    height?: number;
    size?: number;
    url?: string;
    annotation?: string;
    tags?: string[];
    folders?: string[];
    star?: number;
    importedAt?: number;
    modificationTime?: number;
    save?: () => Promise<void>;
    [key: string]: unknown;
  }

  interface EagleAddFromURLOptions {
    name?: string;
    website?: string;
    tags?: string[];
    folders?: string[];
    annotation?: string;
    modificationTime?: number;
    headers?: Record<string, string>;
  }

  interface EagleAddFromBase64Options extends EagleAddFromURLOptions {
    ext?: string;
  }

  interface EagleAddFromPathOptions extends EagleAddFromURLOptions {
    ext?: string;
  }

  interface EagleItemAPI {
    getSelected: () => Promise<EagleItem[]>;
    getAll?: () => Promise<EagleItem[]>;
    getById: (id: string) => Promise<EagleItem | undefined>;
    addFromURL: (url: string, options?: EagleAddFromURLOptions) => Promise<string>;
    addFromBase64: (base64: string, options?: EagleAddFromBase64Options) => Promise<string>;
    addFromPath?: (path: string, options?: EagleAddFromPathOptions) => Promise<string>;
    open?: (itemId: string) => unknown;
  }

  interface EagleTag {
    name: string;
    color?: string;
    count?: number;
    [key: string]: unknown;
  }

  interface EagleTagAPI {
    get?: () => Promise<EagleTag[] | string[]>;
  }

  interface EagleEventAPI {
    onLibraryChanged?: (handler: (libraryPath: string) => void) => void;
    offLibraryChanged?: (handler: (libraryPath: string) => void) => void;
    onThemeChanged?: (handler: (theme: EagleThemeName) => void) => void;
    offThemeChanged?: (handler: (theme: EagleThemeName) => void) => void;
  }

  type EagleThemeName = 'LIGHT' | 'LIGHTGRAY' | 'GRAY' | 'DARK' | 'BLUE' | string;

  interface EagleAppAPI {
    theme?: EagleThemeName;
    [key: string]: unknown;
  }

  interface EagleAPI extends EagleEventAPI {
    onPluginCreate: (handler: (plugin: unknown) => void) => void;
    onPluginRun?: (handler: () => void) => void;
    onPluginShow?: (handler: () => void) => void;
    onPluginHide?: (handler: () => void) => void;
    onPluginBeforeExit?: (handler: () => void) => void;
    onLibraryChanged?: (handler: (libraryPath: string) => void) => void;
    onThemeChanged?: (handler: (theme: EagleThemeName) => void) => void;
    log: EagleLog;
    folder?: EagleFolderAPI;
    item?: EagleItemAPI;
    tag?: EagleTagAPI;
    app?: EagleAppAPI;
  }

  // eslint-disable-next-line no-var
  var eagle: EagleAPI | undefined;
}
