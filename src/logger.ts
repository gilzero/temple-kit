// @file: logger.ts
// @desc: injectable sink for recoverable failures
/** Fields that explain a failure, such as the `error` itself. */
export type LogContext = Readonly<Record<string, unknown>>;

/** The structured logger a game hands to kit modules that can fail. */
export interface TempleLogger {
  warn(msg: string, context?: LogContext): void;
}
