import jquery from 'jquery';

declare global {
  interface Window {
    $: typeof jquery;
    jQuery: typeof jquery;
  }
}

export {};