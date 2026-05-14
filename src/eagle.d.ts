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

  interface EagleAPI {
    onPluginCreate: (handler: (plugin: unknown) => void) => void;
    onPluginRun?: (handler: () => void) => void;
    onPluginShow?: (handler: () => void) => void;
    onPluginHide?: (handler: () => void) => void;
    onPluginBeforeExit?: (handler: () => void) => void;
    log: EagleLog;
    folder?: EagleFolderAPI;
  }

  // eslint-disable-next-line no-var
  var eagle: EagleAPI | undefined;
}
