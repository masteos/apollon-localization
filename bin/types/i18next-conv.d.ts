declare module 'i18next-conv' {
  export interface Options {
    [key: string]: unknown;
  }

  export function gettextToI18next(
    locale: string,
    body: string,
    options?: Options
  ): Promise<string>;

  export function i18nextToPo(locale: string, body: string, options?: Options): Promise<string>;
  export function i18nextToPot(locale: string, body: string, options?: Options): Promise<string>;
  export function i18nextToMo(locale: string, body: string, options?: Options): Promise<string>;
}
