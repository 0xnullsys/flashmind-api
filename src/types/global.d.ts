import jquery from 'jquery';
import 'jquery-scrollify';

declare global {
  interface Window {
    $: typeof jquery;
    jQuery: typeof jquery;
  }
}

export {};