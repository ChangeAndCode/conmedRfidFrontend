import { app, BrowserWindow, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const loadDotEnvFile = () => {
  const envPath = path.join(repoRoot, '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const rawContent = fs.readFileSync(envPath, 'utf8')

  rawContent.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return
    }

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex === -1) {
      return
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    let value = trimmedLine.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

loadDotEnvFile()

const isSimulationEnabled = process.env.CONMED_RFID_ENABLE_SIMULATION !== 'false'

const buildSimulatedDevice = (connectionMethod, deviceId) => {
  if (connectionMethod === 'serial_port') {
    return {
      id: deviceId,
      name: 'Simulador COM RFID',
      connectionMethod,
      status: 'connected',
      serialPortPath: deviceId,
      description: 'Fallback local mientras se integra el protocolo real.',
      isSimulated: true,
    }
  }

  return {
    id: deviceId,
    name: 'Simulador Android USB/NFC',
    connectionMethod,
    status: 'connected',
    deviceId,
    description: 'Fallback local mientras se integra el puente Android real.',
    isSimulated: true,
  }
}

const getSimulatedDevices = (connectionMethod) =>
  isSimulationEnabled
    ? [
        buildSimulatedDevice(
          connectionMethod,
          connectionMethod === 'serial_port' ? 'SIM-COM-1' : 'SIM-ANDROID-1',
        ),
      ]
    : []

const runPowerShell = async (command) => {
  return execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  )
}

const escapePowerShellLiteral = (value) =>
  `'${String(value ?? '').replace(/'/g, "''")}'`

const applyTemplateVariables = (template, replacements) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, token) =>
    escapePowerShellLiteral(replacements[token] ?? ''),
  )
}

const executeConfiguredHardwareCommand = async (template, replacements) => {
  const command = applyTemplateVariables(template, replacements)
  const { stdout } = await runPowerShell(command)
  return stdout.trim()
}

const readPowerShellStdout = async (command) => {
  try {
    const { stdout } = await runPowerShell(command)
    return stdout.trim()
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout.trim()) {
      return error.stdout.trim()
    }

    return ''
  }
}

const parseJsonOutput = (stdout) => {
  if (!stdout) {
    return []
  }

  try {
    const parsed = JSON.parse(stdout)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

const cleanWindowsDeviceLabel = (value) => {
  if (!value) {
    return ''
  }

  const normalizedValue = String(value).trim()
  const semicolonIndex = normalizedValue.lastIndexOf(';')

  return semicolonIndex >= 0
    ? normalizedValue.slice(semicolonIndex + 1).trim()
    : normalizedValue
}

const removeEmbeddedComPort = (value, portName) =>
  value.replace(new RegExp(`\\s*\\(${portName}\\)$`, 'i'), '').trim()

const buildSerialPortDisplayName = (portName, metadata) => {
  const candidateLabel =
    cleanWindowsDeviceLabel(metadata?.FriendlyName) ||
    cleanWindowsDeviceLabel(metadata?.DeviceDesc)

  if (!candidateLabel) {
    return portName
  }

  const cleanedLabel = removeEmbeddedComPort(candidateLabel, portName)

  if (!cleanedLabel || cleanedLabel.toUpperCase() === portName.toUpperCase()) {
    return portName
  }

  return `${portName} | ${cleanedLabel}`
}

const buildSerialPortDescription = (portName, metadata, fallbackDescription) => {
  const descriptionParts = []
  const cleanedFriendlyName = cleanWindowsDeviceLabel(metadata?.FriendlyName)
  const cleanedDeviceDescription = cleanWindowsDeviceLabel(metadata?.DeviceDesc)
  const cleanedManufacturer = cleanWindowsDeviceLabel(metadata?.Mfg)

  if (cleanedFriendlyName) {
    descriptionParts.push(removeEmbeddedComPort(cleanedFriendlyName, portName))
  }

  if (
    cleanedDeviceDescription &&
    cleanedDeviceDescription.toLowerCase() !== cleanedFriendlyName.toLowerCase()
  ) {
    descriptionParts.push(cleanedDeviceDescription)
  }

  if (cleanedManufacturer) {
    descriptionParts.push(`Fabricante: ${cleanedManufacturer}`)
  }

  return descriptionParts.length > 0
    ? descriptionParts.join(' | ')
    : fallbackDescription
}

const getConfiguredHardwareCommand = (connectionMethod, action) => {
  if (connectionMethod === 'serial_port') {
    switch (action) {
      case 'read_tag_id':
        return process.env.CONMED_RFID_SERIAL_READ_TAG_COMMAND
      case 'read_payload_text':
        return process.env.CONMED_RFID_SERIAL_READ_PAYLOAD_TEXT_COMMAND
      case 'write_payload':
        return process.env.CONMED_RFID_SERIAL_WRITE_PAYLOAD_COMMAND
      default:
        return ''
    }
  }

  switch (action) {
    case 'read_tag_id':
      return process.env.CONMED_RFID_ANDROID_READ_TAG_COMMAND
    case 'read_payload_text':
      return process.env.CONMED_RFID_ANDROID_READ_PAYLOAD_TEXT_COMMAND
    case 'write_payload':
      return process.env.CONMED_RFID_ANDROID_WRITE_PAYLOAD_COMMAND
    default:
      return ''
  }
}

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const parsePayloadReadObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      payloadText: '',
      tagId: '',
    }
  }

  return {
    payloadText: pickFirstString(
      value.payloadText,
      value.rfidPayloadText,
      value.payload,
      value.rawText,
      value.text,
      value.content,
    ),
    tagId: pickFirstString(value.tagId, value.uid, value.epc),
  }
}

const parsePayloadReadKeyValueLines = (lines) => {
  const values = {}

  lines.forEach((line) => {
    const match = line.match(/^([^:=]+?)\s*[:=]\s*(.+)$/)

    if (!match) {
      return
    }

    const key = match[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const value = match[2].trim()

    if (!key || !value) {
      return
    }

    values[key] = value
  })

  return {
    payloadText: pickFirstString(
      values.payloadtext,
      values.rfidpayloadtext,
      values.payload,
      values.rawtext,
      values.text,
      values.content,
    ),
    tagId: pickFirstString(values.tagid, values.uid, values.epc),
  }
}

const parsePayloadReadOutput = (stdout) => {
  const trimmedOutput = String(stdout ?? '').trim()

  if (!trimmedOutput) {
    return {
      payloadText: '',
      tagId: '',
    }
  }

  try {
    const parsedOutput = JSON.parse(trimmedOutput)
    const payloadResult = Array.isArray(parsedOutput)
      ? parsePayloadReadObject(parsedOutput[0])
      : parsePayloadReadObject(parsedOutput)

    if (payloadResult.payloadText || payloadResult.tagId) {
      return payloadResult
    }
  } catch {
    // Intentionally continue with line-based parsing.
  }

  const lines = trimmedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const keyValuePayloadResult = parsePayloadReadKeyValueLines(lines)

  if (keyValuePayloadResult.payloadText || keyValuePayloadResult.tagId) {
    return keyValuePayloadResult
  }

  return {
    payloadText: lines[0] ?? '',
    tagId: lines[1] ?? '',
  }
}

const resolveAdbExecutable = async () => {
  const configuredAdbPath =
    process.env.CONMED_RFID_ADB_PATH ?? process.env.ADB_PATH

  if (configuredAdbPath && fs.existsSync(configuredAdbPath)) {
    return configuredAdbPath
  }

  try {
    const { stdout } = await execFileAsync('where.exe', ['adb'], {
      cwd: repoRoot,
      windowsHide: true,
    })
    const resolvedPath = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)

    return resolvedPath || null
  } catch {
    return null
  }
}

const listSerialPortMetadata = async (portNames) => {
  if (!Array.isArray(portNames) || portNames.length === 0) {
    return new Map()
  }

  const quotedPortNames = portNames
    .map((portName) => `'${String(portName).replace(/'/g, "''")}'`)
    .join(',')

  const stdout = await readPowerShellStdout(`
$ports = @(${quotedPortNames})
Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum' -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.PSChildName -eq 'Device Parameters' } |
  ForEach-Object {
    try {
      $props = Get-ItemProperty $_.PSPath -ErrorAction Stop
      if ($ports -contains $props.PortName) {
        $parentPath = Split-Path $_.PSPath -Parent
        $parent = Get-ItemProperty $parentPath -ErrorAction SilentlyContinue
        [pscustomobject]@{
          PortName = $props.PortName
          FriendlyName = $parent.FriendlyName
          DeviceDesc = $parent.DeviceDesc
          Mfg = $parent.Mfg
        }
      }
    } catch {}
  } | ConvertTo-Json -Compress
`)

  const metadataByPortName = new Map()

  parseJsonOutput(stdout).forEach((entry) => {
    const normalizedPortName = String(entry?.PortName ?? '').trim().toUpperCase()

    if (!normalizedPortName) {
      return
    }

    metadataByPortName.set(normalizedPortName, entry)
  })

  return metadataByPortName
}

const listSerialPortDevices = async () => {
  const discoveredPorts = new Map()

  try {
    const { stdout } = await runPowerShell(
      "Get-ItemProperty HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { $_.Value } }",
    )

    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^COM\d+$/i.test(line))
      .forEach((portName) => {
        discoveredPorts.set(portName.toUpperCase(), {
          id: portName.toUpperCase(),
          name: portName.toUpperCase(),
          connectionMethod: 'serial_port',
          status: 'available',
          serialPortPath: portName.toUpperCase(),
          description: 'Puerto serial detectado desde el registro de Windows.',
          isSimulated: false,
        })
      })
  } catch {
    // Intenta el siguiente fallback.
  }

  if (discoveredPorts.size === 0) {
    try {
      const { stdout } = await execFileAsync('mode.com', [], {
        cwd: repoRoot,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      })

      const matches = stdout.match(/COM\d+/gi) ?? []
      matches.forEach((portName) => {
        const normalizedPortName = portName.toUpperCase()

        if (!discoveredPorts.has(normalizedPortName)) {
          discoveredPorts.set(normalizedPortName, {
            id: normalizedPortName,
            name: normalizedPortName,
            connectionMethod: 'serial_port',
            status: 'available',
            serialPortPath: normalizedPortName,
            description: 'Puerto serial detectado con mode.com.',
            isSimulated: false,
          })
        }
      })
    } catch {
      // Si esto falla, se regresara simulacion si esta habilitada.
    }
  }

  if (discoveredPorts.size > 0) {
    const metadataByPortName = await listSerialPortMetadata(
      Array.from(discoveredPorts.keys()),
    )

    discoveredPorts.forEach((device, portName) => {
      const metadata = metadataByPortName.get(portName)

      if (!metadata) {
        return
      }

      device.name = buildSerialPortDisplayName(portName, metadata)
      device.description = buildSerialPortDescription(
        portName,
        metadata,
        device.description,
      )
    })
  }

  return Array.from(discoveredPorts.values())
}

const parseAdbDevices = (stdout) => {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith('List of devices attached') &&
        !line.startsWith('*'),
    )
    .map((line) => {
      const [deviceId, state, ...rest] = line.split(/\s+/)
      const modelToken = rest.find((token) => token.startsWith('model:'))
      const productToken = rest.find((token) => token.startsWith('product:'))
      const deviceToken = rest.find((token) => token.startsWith('device:'))
      const normalizedState = (state || '').toLowerCase()
      const connectionStatus =
        normalizedState === 'device'
          ? 'available'
          : normalizedState === 'unauthorized'
            ? 'unauthorized'
            : normalizedState === 'offline'
              ? 'offline'
              : 'connected'

      return {
        id: deviceId,
        name:
          modelToken?.slice('model:'.length) ||
          deviceToken?.slice('device:'.length) ||
          productToken?.slice('product:'.length) ||
          deviceId,
        connectionMethod: 'android_usb_nfc',
        status: connectionStatus,
        deviceId,
        description: line,
        isSimulated: false,
      }
    })
}

const listAndroidDevices = async () => {
  const adbExecutable = await resolveAdbExecutable()

  if (!adbExecutable) {
    return []
  }

  try {
    const { stdout } = await execFileAsync(adbExecutable, ['devices', '-l'], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })

    return parseAdbDevices(stdout)
  } catch {
    return []
  }
}

const listHardwareDevices = async (connectionMethod) => {
  const realDevices =
    connectionMethod === 'serial_port'
      ? await listSerialPortDevices()
      : await listAndroidDevices()

  if (realDevices.length > 0) {
    return realDevices
  }

  return getSimulatedDevices(connectionMethod)
}

const resolveDeviceForConnection = async (connectionMethod, deviceId) => {
  const devices = await listHardwareDevices(connectionMethod)
  const resolvedDevice = devices.find((device) => device.id === deviceId)

  if (resolvedDevice) {
    if (resolvedDevice.status === 'unauthorized') {
      throw new Error(
        'El telefono esta detectado por ADB pero falta autorizar la depuracion USB en Android.',
      )
    }

    if (resolvedDevice.status === 'offline') {
      throw new Error(
        'El telefono aparece offline en ADB. Desconectalo, reconectalo y verifica la depuracion USB.',
      )
    }

    return {
      ...resolvedDevice,
      status: 'connected',
    }
  }

  if (isSimulationEnabled) {
    return buildSimulatedDevice(connectionMethod, deviceId)
  }

  throw new Error('El dispositivo solicitado ya no esta disponible.')
}

const performReadTagId = async (connectionMethod, deviceId) => {
  const resolvedDevice = await resolveDeviceForConnection(connectionMethod, deviceId)
  const configuredCommand = getConfiguredHardwareCommand(
    connectionMethod,
    'read_tag_id',
  )

  if (!configuredCommand) {
    if (!isSimulationEnabled) {
      throw new Error(
        connectionMethod === 'android_usb_nfc'
          ? 'El telefono fue detectado, pero falta configurar CONMED_RFID_ANDROID_READ_TAG_COMMAND para leer el tag real.'
          : 'El lector fue detectado, pero falta configurar CONMED_RFID_SERIAL_READ_TAG_COMMAND para leer el tag real.',
      )
    }

    const tagSuffix = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0')

    return {
      tagId: `SIMTAG${tagSuffix}`,
      device: {
        ...resolvedDevice,
        isSimulated: true,
      },
      simulated: true,
    }
  }

  const stdout = await executeConfiguredHardwareCommand(configuredCommand, {
    connectionMethod,
    deviceId,
    serialPortPath: resolvedDevice.serialPortPath ?? deviceId,
    androidDeviceId: resolvedDevice.deviceId ?? deviceId,
  })

  if (!stdout) {
    throw new Error('El comando de lectura RFID no devolvio un tagId.')
  }

  const [tagIdLine] = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  if (!tagIdLine) {
    throw new Error('No se pudo interpretar el tagId devuelto por el hardware.')
  }

  return {
    tagId: tagIdLine,
    device: resolvedDevice,
    simulated: false,
  }
}

const performReadPayloadText = async (connectionMethod, deviceId) => {
  const resolvedDevice = await resolveDeviceForConnection(connectionMethod, deviceId)
  const configuredCommand = getConfiguredHardwareCommand(
    connectionMethod,
    'read_payload_text',
  )

  if (!configuredCommand) {
    if (!isSimulationEnabled) {
      throw new Error(
        connectionMethod === 'android_usb_nfc'
          ? 'El telefono fue detectado, pero falta configurar CONMED_RFID_ANDROID_READ_PAYLOAD_TEXT_COMMAND para leer el contenido RFID real.'
          : 'El lector fue detectado, pero falta configurar CONMED_RFID_SERIAL_READ_PAYLOAD_TEXT_COMMAND para leer el contenido RFID real.',
      )
    }

    const payloadSuffix = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0')

    return {
      payloadText: `SIM-RFID-PAYLOAD-${payloadSuffix}`,
      tagId: `SIMTAG${payloadSuffix}`,
      device: {
        ...resolvedDevice,
        isSimulated: true,
      },
      simulated: true,
    }
  }

  const stdout = await executeConfiguredHardwareCommand(configuredCommand, {
    connectionMethod,
    deviceId,
    serialPortPath: resolvedDevice.serialPortPath ?? deviceId,
    androidDeviceId: resolvedDevice.deviceId ?? deviceId,
  })

  const payloadResult = parsePayloadReadOutput(stdout)

  if (!payloadResult.payloadText) {
    throw new Error(
      'El comando de lectura RFID no devolvio el contenido RFID esperado para la verificacion.',
    )
  }

  if (!payloadResult.tagId) {
    throw new Error(
      'El comando de lectura RFID no devolvio el tagId esperado para la verificacion.',
    )
  }

  return {
    payloadText: payloadResult.payloadText,
    tagId: payloadResult.tagId,
    device: resolvedDevice,
    simulated: false,
  }
}

const performWritePayload = async (request) => {
  const resolvedDevice = await resolveDeviceForConnection(
    request.connectionMethod,
    request.deviceId,
  )
  const configuredCommand = getConfiguredHardwareCommand(
    request.connectionMethod,
    'write_payload',
  )

  if (!configuredCommand) {
    if (!isSimulationEnabled) {
      throw new Error(
        request.connectionMethod === 'android_usb_nfc'
          ? 'El telefono fue detectado, pero falta configurar CONMED_RFID_ANDROID_WRITE_PAYLOAD_COMMAND para escribir el payload real.'
          : 'El lector fue detectado, pero falta configurar CONMED_RFID_SERIAL_WRITE_PAYLOAD_COMMAND para escribir el payload real.',
      )
    }

    return {
      success: true,
      message: `Escritura simulada completada para ${request.tagId}.`,
      simulated: true,
      device: {
        ...resolvedDevice,
        isSimulated: true,
      },
    }
  }

  const stdout = await executeConfiguredHardwareCommand(configuredCommand, {
    connectionMethod: request.connectionMethod,
    deviceId: request.deviceId,
    serialPortPath: resolvedDevice.serialPortPath ?? request.deviceId,
    androidDeviceId: resolvedDevice.deviceId ?? request.deviceId,
    tagId: request.tagId,
    payloadHex: request.payloadHex,
  })

  return {
    success: true,
    message: stdout || `Payload escrito correctamente en ${request.tagId}.`,
    simulated: false,
    device: resolvedDevice,
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.loadURL('http://localhost:5173')
}

function registerRfidIpcHandlers() {
  ipcMain.handle('conmed-rfid:list-devices', async (_event, connectionMethod) => {
    return listHardwareDevices(connectionMethod)
  })

  ipcMain.handle(
    'conmed-rfid:connect-device',
    async (_event, { connectionMethod, deviceId }) => {
      return resolveDeviceForConnection(connectionMethod, deviceId)
    },
  )

  ipcMain.handle(
    'conmed-rfid:read-tag-id',
    async (_event, { connectionMethod, deviceId }) => {
      return performReadTagId(connectionMethod, deviceId)
    },
  )

  ipcMain.handle(
    'conmed-rfid:read-payload-text',
    async (_event, { connectionMethod, deviceId }) => {
      return performReadPayloadText(connectionMethod, deviceId)
    },
  )

  ipcMain.handle('conmed-rfid:write-payload', async (_event, request) => {
    return performWritePayload(request)
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
