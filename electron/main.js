import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildSimulatedDevice = (connectionMethod, deviceId) => {
  if (connectionMethod === 'serial_port') {
    return {
      id: deviceId,
      name: 'Simulador COM RFID',
      connectionMethod,
      status: 'connected',
      serialPortPath: deviceId,
      description: 'Stub local hasta integrar el lector real.',
      isSimulated: true,
    }
  }

  return {
    id: deviceId,
    name: 'Simulador Android USB/NFC',
    connectionMethod,
    status: 'connected',
    deviceId,
    description: 'Stub local hasta integrar el puente Android real.',
    isSimulated: true,
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadURL('http://localhost:5173')
}

function registerRfidIpcHandlers() {
  ipcMain.handle('conmed-rfid:list-devices', (_event, connectionMethod) => {
    return [
      buildSimulatedDevice(
        connectionMethod,
        connectionMethod === 'serial_port' ? 'SIM-COM-1' : 'SIM-ANDROID-1',
      ),
    ]
  })

  ipcMain.handle(
    'conmed-rfid:connect-device',
    (_event, { connectionMethod, deviceId }) => {
      return buildSimulatedDevice(connectionMethod, deviceId)
    },
  )

  ipcMain.handle(
    'conmed-rfid:read-tag-id',
    (_event, { connectionMethod, deviceId }) => {
      const tagSuffix = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0')

      return {
        tagId: `SIMTAG${tagSuffix}`,
        device: buildSimulatedDevice(connectionMethod, deviceId),
        simulated: true,
      }
    },
  )

  ipcMain.handle('conmed-rfid:write-payload', (_event, request) => {
    return {
      success: true,
      message: `Escritura simulada completada para ${request.tagId}.`,
      simulated: true,
      device: buildSimulatedDevice(request.connectionMethod, request.deviceId),
    }
  })
}

app.whenReady().then(() => {
  registerRfidIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
