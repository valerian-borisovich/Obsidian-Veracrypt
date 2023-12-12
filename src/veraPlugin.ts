//
// import {Notice,Plugin,setIcon,TFolder,TFile,TAbstractFile,debounce,DropdownComponent,normalizePath,} from 'obsidian'
import { Plugin, Menu, TFolder, TFile, TAbstractFile, normalizePath,} from 'obsidian'
import * as fsPromises from 'fs/promises'
import { log, dbg, err, warn, machineIdSync } from './hlp'
import { I18n } from "./hlp/i18n"
import type { LangType, LangTypeAndAuto, TransItemType } from "./hlp/i18n";
import { VeraPluginSettings, DEFAULT_SETTINGS } from './settings'
import { VeraSettingTab } from './settingsModal'
import { PasswordPromt } from './passwordModal'
import { DEFAULT_VOLUME_CONFIG, VolumeConfig } from './volume'
import { Vera } from './vera'
import { VolumesManager } from './volumesManager'
import { ADMIN_PASSWORD } from './constant'

const ROOT_PATH = '/'

export default class VeraPlugin extends Plugin {
  settings!: VeraPluginSettings
  vera!: Vera
  mng!: VolumesManager
  //
  ribbonIconButton!: HTMLElement
  statusBarItem!: HTMLElement

  promts: string[] = []

  /*   lang   */
  i18n!: I18n
  t = (x: TransItemType, vars?: any) => {
    return this.i18n.t(x, vars);
  };

  /*
   *
   */
  async getPassword(name: string, promt: boolean = true) {
    let pass = await this.vera.getPassword(name)
    // dbg(`VeraPlugin.getPassword: ${id} == ${pass}`)
    if (pass === '' && promt) {
      if (!this.promts.contains(name)) {
        this.promts.push(name)
        let dlg = new PasswordPromt(this.app, this, name, '')
        dlg.open()
        pass = await this.vera.getPassword(name)
        // dbg(`VeraPlugin.getPassword again: ${id} == ${pass}`)
      }
    }
    return pass
  }

  async setPassword(name: string, password: string) {
    await this.vera.setPassword(name, password)
    // dbg(`VeraPlugin.setPassword: ${id} : ${password}`)
  }
  /*
   *
   */
  getAbsolutePath(path: String) {
    let root = (this.app.vault.adapter as any).basePath
    return normalizePath(`${root}/${path}`)
  }

  async checkFolder(path: string, create: Boolean = true) {
    let folderpath = normalizePath(path)

    //@ts-ignore
    const folder = this.app.vault.getAbstractFileByPathInsensitive(folderpath)
    if (folder && folder instanceof TFolder) {
      return
    }
    if (folder && folder instanceof TFile) {
      warn(`The folder cannot be created because it already exists as a file: ${folderpath}.`)
    }

    // if (!(await this.app.vault.adapter.exists(folderpath))) {
    if (create) {
      await this.app.vault.createFolder(folderpath)
    }
    // }
  }

  async name(filename: string) {
    return filename.substring(filename.lastIndexOf('/') ? 0 : filename.lastIndexOf('/'), filename.lastIndexOf('.'))
  }

  async exists(filename: string) {
    return await this.app.vault.adapter.exists(filename)
  }

  /*
   *
   */
  private _fsPromises!: typeof fsPromises

    private async reloadFileExplorer(): Promise<void> {
    await this.reloadFolder(ROOT_PATH, true)
  }

  public async reloadFolder(directoryPath: string, isRecursive: boolean): Promise<void> {
    const isRoot = directoryPath === ROOT_PATH
    const adapter = this.app.vault.adapter
    console.debug(`Reloading directory ${directoryPath}`)
    await adapter.reconcileFolderCreation(directoryPath, directoryPath)
    const absolutePath = isRoot ? adapter.basePath : `${adapter.basePath}/${directoryPath}`

    const existingFileItems = (await this._fsPromises.readdir(absolutePath, { withFileTypes: true }))
      .filter(f => !f.name.startsWith('.'))
    const existingFileNames = new Set(existingFileItems.map(f => f.name))

    const dir = this.app.vault.getAbstractFileByPath(directoryPath) as TFolder
    const obsidianFileNames = new Set(dir.children.map(child => child.name).filter(name => name))

    for (const fileName of existingFileNames) {
      if (!obsidianFileNames.has(fileName)) {
        const path = this.combinePath(directoryPath, fileName)
        console.debug(`Adding new file ${path}`)
        await adapter.reconcileFile(path, path, false)
      }
    }

    for (const fileName of obsidianFileNames) {
      if (!existingFileNames.has(fileName)) {
        const path = this.combinePath(directoryPath, fileName)
        console.debug(`Deleting inexistent ${path}`)
        await adapter.reconcileFile('', path, false)
      }
    }

    if (isRecursive) {
      for (const existingFileItem of existingFileItems) {
        if (existingFileItem.isDirectory()) {
          const path = this.combinePath(directoryPath, existingFileItem.name)
          await this.reloadFolder(path, true)
        }
      }
    }
  }

  private combinePath(directoryPath: string, fileName: string): string {
    const isRoot = directoryPath === ROOT_PATH
    return isRoot ? fileName : `${directoryPath}/${fileName}`
  }

  private handleFileMenu(menu: Menu, file: TAbstractFile) {
    if (!(file instanceof TFolder)) {
      return
    }

    menu.addItem((item) => {
      item
        .setTitle('Reload Folder')
        .setIcon('folder-sync')
        .onClick(() => this.reloadFolder(file.path, false))
    })

    menu.addItem((item) => {
      item
        .setTitle('Reload Folder with Subfolders')
        .setIcon('folder-sync')
        .onClick(() => this.reloadFolder(file.path, true))
    })
  }
  /*
   *
   */
  async  onload() {
    if (!this.app.vault.adapter.fsPromises) {throw new Error('app.vault.adapter.fsPromises is not initialized')}

    this._fsPromises = this.app.vault.adapter.fsPromises

    await this.loadSettings()
    log(`Vera plugin version ${this.manifest.version} loaded.`)

    // lang should be load early, but after settings
    this.i18n = new I18n(this.settings.lang, async (lang: LangTypeAndAuto) => {
      this.settings.lang = lang
      await this.saveSettings()
    });

    this.vera = new Vera(this.settings)
    this.mng = new VolumesManager(this)

    await this.install(true)

    await this.mng.refresh()

    /*
    // This creates an icon in the left ribbon.
    this.ribbonIconButton = this.addRibbonIcon(
      this.settings.pluginLoaded ? 'eye' : 'eye-off',
      this.settings.pluginLoaded ? 'Mount all' : 'Unmount all',
      () => {
        this.toggleFunctionality()
      },
    )
    */

    /*
    this.addRibbonIcon('dice', 'Vera', async () => {
      // new Notice('is a veracrypt notice!')
      //
      let d = '/'
      await this.refreshFolder(d)
    })
    */

    this.addRibbonIcon('eye', 'Vera mount all', async () => {
      await this.mng.mountAll()
    })

    this.addRibbonIcon('trash', 'Vera umount all', async () => {
      await this.mng.umountAll()
    })

    this.addRibbonIcon('dice', 'Vera refresh', async () => {
      await this.mng.refresh()
    })

    this.addRibbonIcon('cloud', 'Vera install example', async () => {
      await this.install_example()
    })

    /*
    this.addCommand({
      id: 'open-vera-modal',
      name: 'Open Veracrypt Modal',
      // callback: () => {
      // 	log('Veracrypt Modal Callback');
      // },
      checkCallback: (checking: boolean) => {
        let leaf = this.app.workspace.activeLeaf
        if (leaf) {
          if (!checking) {
            new VolumeModal(this.app, this, ).open()
          }
          return true
        }
        return false
      },
    })
    */
    this.addCommand({
      id: 'veracrypt-umount-all',
      name: 'Veracrypt Unmount All',
      callback: () => {
        log('Veracrypt Unmount Callback')
      },
      checkCallback: (checking: boolean) => {
        if (!checking) {
          log('Veracrypt checkCallback checking')
        }
        this.mng.umountAll()
      },
    })

    this.addSettingTab(new VeraSettingTab(this.app, this))

    // this.registerDomEvent(document, 'click', (evt: MouseEvent) => { log('click', evt) })

    // this.registerInterval(window.setInterval(() => log('setInterval'), 5 * 60 * 1000))

    /*
    this.registerInterval(
      window.setInterval(() => {
        log('listVolumes')
        this.volumesList()
      }, 2 * 1000),
    )
    */

    this.app.workspace.onLayoutReady(async () => {
      if (this.settings.mountAtStart) {
        dbg(`onLayoutReady : mountAtStart`)
        await this.mng.mountAll()
      }
    })

    this.addCommand({
      id: 'reload-file-explorer',
      name: 'Reload File Explorer',
      callback: this.reloadFileExplorer.bind(this),
    })

    this.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenu.bind(this)))

    this.addStatusBarItem().setText('Veracrypt loaded')
    // DropdownComponent
    this.settings.pluginLoaded = true
  }

  async onunload() {
    dbg('Unloading veracrypt plugin')
    if (this.settings.umountAtExit) {
      await this.mng.umountAll()
    }
  }

  async install_example(force: boolean = false) {
    /*   create exampe volume   */
    let vol: VolumeConfig = DEFAULT_VOLUME_CONFIG
    vol.filename = 'example.vera'
    vol.mountPath = '==example=='
    await this.mng.create(vol, 'example')
  }

  async install(force: boolean = false) {
    if (this.settings.devID !== '' && !force) return

    /*   install plugin   */
    this.settings.devID = machineIdSync(true)
    this.settings.pluginVersion = this.manifest.version
    this.settings.debug = '1'
    log(`${this.manifest.name} install on device ${this.settings.devID}`)
    let pass = await this.getPassword(ADMIN_PASSWORD)
    //if (pass !== '') await this.setPassword(ADMIN_PASSWORD, pass)
    await this.saveSettings()
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  /*
  async reloadFolder(folderPath: string) {
    try {
      const adapter = this.app.vault.adapter
      await reload(folderPath)
      // @ts-ignore
      const existingFileNames = new Set(await adapter.fsPromises.readdir(`${adapter.basePath}/${folderPath}`))
      const dir = this.app.vault.getAbstractFileByPath(folderPath)
      // @ts-ignore
      const obsidianFileNames = new Set(dir.children.map((child) => child.name))
      let fileName: string

      for (fileName of existingFileNames) {
        if (!obsidianFileNames.has(fileName)) {
          await reload(`${folderPath}/${fileName}`)
        }
      }

      // @ts-ignore
      for (fileName of obsidianFileNames) {
        if (!existingFileNames.has(fileName)) {
          const path = `${folderPath}/${fileName}`
          //dbg(`refreshFolder.onDeleting: ${path}`)
          // @ts-ignore
          await adapter.reconcileFile('', path)
        }
      }

      async function reload(path: string) {
        //dbg(`reconcileFile: ${path}`)
        // @ts-ignore
        await adapter.reconcileFile(path, path)
      }
    } catch (e) {
      err(`refreshFolder: ${e}`)
    }
  }
  */
}
