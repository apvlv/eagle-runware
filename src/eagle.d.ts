export {};

declare global {
  interface EagleLog {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  }

  interface EagleAPI {
    onPluginCreate: (handler: (plugin: unknown) => void) => void;
    onPluginRun?: (handler: () => void) => void;
    onPluginShow?: (handler: () => void) => void;
    onPluginHide?: (handler: () => void) => void;
    onPluginBeforeExit?: (handler: () => void) => void;
    log: EagleLog;
  }

  // eslint-disable-next-line no-var
  var eagle: EagleAPI | undefined;
}
