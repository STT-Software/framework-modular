import { makeAutoObservable } from "mobx";
/** El aviso breve que aparece abajo (la referencia lo llama «toast»): un mensaje que se quita solo a los 5 segundos. */
class ToastStore {
  message = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  announce(message: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.message = message;
    this.timer = setTimeout(() => {
      this.message = "";
    }, 5000);
  }
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.message = "";
  }
}
export const toastStore = new ToastStore();
