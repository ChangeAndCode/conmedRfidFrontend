import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('conmedRfidHardware', {
  listDevices: (connectionMethod) =>
    ipcRenderer.invoke('conmed-rfid:list-devices', connectionMethod),
  connectDevice: (request) =>
    ipcRenderer.invoke('conmed-rfid:connect-device', request),
  readTagId: (request) =>
    ipcRenderer.invoke('conmed-rfid:read-tag-id', request),
  writePayload: (request) =>
    ipcRenderer.invoke('conmed-rfid:write-payload', request),
})
