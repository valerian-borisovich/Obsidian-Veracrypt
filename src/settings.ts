import { version } from './hlp'
import { VolumeSettings } from './volume'

export interface VeraPluginSettings {
  devID: string

  pluginVersion: string
  pluginLoaded: boolean
  pluginDebug: boolean
  logFilename: string

  defaultMountPath: string
  defaultVolumefileExtention: string
  mountAtStart: boolean
  umountAtExit: boolean

  sudoPassword: string
  sudoSave: boolean

  vaultName: string
  vaultPath: string
  vaultConfig: string

  volumes: VolumeSettings[]
}

export const DEFAULT_SETTINGS: VeraPluginSettings = {
  devID: '',

  pluginVersion: version,
  pluginLoaded: false,
  pluginDebug: false,

  logFilename: 'vera.log',

  defaultMountPath: '==vera==',
  defaultVolumefileExtention: 'vera',

  mountAtStart: true,
  umountAtExit: true,

  sudoPassword: '',
  sudoSave: true,

  vaultName: 'vera',
  vaultPath: '/pub/==vaults==/vera',
  vaultConfig: '.obsidian',

  volumes: [],
}
