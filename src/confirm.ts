import { App, ButtonComponent, Modal } from 'obsidian'

export async function confirmWithModal(
  app: App,
  head: string = '',
  text: string = '',
  buttons: { cta: string; secondary: string } = {
    cta: 'Yes',
    secondary: 'No',
  },
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const modal = new ConfirmModal(app, head, text, buttons)
      modal.onClose = () => {
        resolve(modal.confirmed)
      }
      modal.open()
    } catch (e) {
      reject()
    }
  })
}

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    public head: string = '',
    public text: string = '',
    public buttons?: { cta: string; secondary: string },
  ) {
    super(app)
  }
  confirmed: boolean = false
  async display() {
    this.contentEl.empty()
    this.contentEl.addClass('confirm-modal')
    this.contentEl.createEl('h1', { text: this.head })
    this.contentEl.createEl('p', { text: this.text })
    const buttonEl = this.contentEl.createDiv('confirm-buttons')
    new ButtonComponent(buttonEl)
      .setButtonText(this.buttons.cta)
      .setCta()
      .setClass('delete')
      .onClick(() => {
        this.confirmed = true
        this.close()
      })
    new ButtonComponent(buttonEl).setButtonText(this.buttons.secondary).onClick(() => {
      this.close()
    })
  }
  onOpen() {
    this.display()
  }
}
