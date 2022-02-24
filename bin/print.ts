import loading from 'loading-cli';
import { option } from 'yargs';

export { default as kleur } from 'kleur';

interface Options {
  clear?: boolean;
  format?: (str: string) => string;
  loading?: boolean;
}

export type PrintLoading = loading.Loading & {
  progress: (progession: number | string) => loading.Loading;
  originalText: string;
};

interface OptionWithLoading extends Omit<Options, 'loading'> {
  loading: true;
}

type PrintReturn<T extends Options> = T extends OptionWithLoading ? PrintLoading : undefined;

export function print<T extends Options = Options>(...args: [...string[], T]): PrintReturn<T>;

export function print(...args: [...string[], Options]): PrintLoading | undefined {
  let message = args.shift() as string;
  let opts: Options = {
    clear: false,
    loading: false,
  };

  if (args.length != 0) {
    const lastParams = args.pop();

    if (typeof lastParams === 'object') {
      opts = lastParams as Options;
    }
  }

  if (opts.clear) {
    console.clear();
  }

  if (typeof opts.format === 'function') {
    message = opts.format(message);
  }

  if (opts.loading) {
    const task = loading({
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
      text: message,
    }).start() as PrintLoading;

    task.progress = function (progression = 0) {
      if (!this.originalText) {
        this.originalText = this.text;
      }

      const progressText = typeof progression === 'number' ? `${progression}%` : progression;

      this.text = `${this.originalText}\t${progressText}`;

      const originalSucceed = this.succeed.bind(this);

      this.succeed = function (...args) {
        this.text = this.originalText;

        return originalSucceed(...args);
      };

      return task;
    };

    return task;
  }

  console.log(opts);

  if (message != null) {
    console.log(message, ...args);
  }

  return undefined;
}
