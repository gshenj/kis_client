const { app, BrowserWindow, dialog, autoUpdater, Tray, Menu, ipcMain, net } = require('electron')
const path = require('path')
const fs = require('fs')
const clearFlagFileName = '.clear'
const appIcon = path.join(__dirname, 'app.ico')
const appData = path.join(__dirname, 'data')
const clearFlagFile = path.join(appData, clearFlagFileName)
let mainWindow, aboutWindow

if (fs.existsSync(clearFlagFile)) {
    //清空缓存,rmdirSync开始于node 12.10
    fs.rmdirSync(appData, { recursive: true })
}

app.setPath('userData', appData)

const squirrel = require('electron-squirrel-startup')
if (squirrel) {
    app.quit(1)
}

//startupEventHandle();
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()

app.on('second-instance', () => {
    // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

app.on('ready', createWindow)

ipcMain.on('check-update', () => {
    const request = net.request(getUpdateUrl() + '/RELEASES?t=' + new Date().getTime())
    request.on('response', response => {
        let txt = ''
        response.on('data', chunk => {
            txt += chunk.toString('utf8')
        })
        response.on('end', () => {
            let vInfos = txt.split(' ')
            let appNames = vInfos[1].split('-')
            var pjson = require('./package.json')
            let ret = null
            if (versionCompare(appNames[1], pjson.version) > 0) {
                ret = {
                    currentVersion: pjson.version,
                    newVersion: appNames[1],
                }
            }
            sendToAboutWindow('check-update-reply', ret)
        })
        response.on('error', () => {
            sendToAboutWindow('update-error', null)
        })
    })
    request.on('error', error => {
        sendToAboutWindow('update-error', error)
    })
    request.end()
})

ipcMain.on('start-update', () => {
    const updateUrl = getUpdateUrl()
    if (!updateUrl) {
        console.log('No update url!')
        return false
    }
    autoUpdater.setFeedURL(updateUrl)
    autoUpdater.checkForUpdates()
})

ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall()
})

ipcMain.on('clear-app-data', () => {
    const options = {
        type: 'question',
        title: '确定',
        message: '清除应用缓存数据后程序将重新启动，是否确定?',
        buttons: ['确定', '取消'],
    }
    dialog.showMessageBox(options).then(result => {
        if (result.response == 0) {
            fs.writeFileSync(clearFlagFile)
            app.relaunch()
            app.quit(0)
        }
    })
})

ipcMain.on('open-new-window', arg => {
    let url = arg || ''
    let newWindow = new BrowserWindow({
        icon: appIcon,
        width: 1200,
        height: 800,
        show: false,
        title: '',
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    })
    newWindow.on('closed', () => {
        newWindow = null
    })
    newWindow.on('ready-to-show', () => {
        newWindow.show()
    })
    newWindow.webContents.loadURL(url)
})

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: appIcon,
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        title: '',
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    })

    const url = getUrl() || ''
    // 然后加载应用的 index.html
    let contents = mainWindow.webContents
    // 当 window 被关闭，这个事件会被触发
    mainWindow.on('closed', () => {
        mainWindow = null
        app.quit()
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
        mainWindow.maximize()
    })

    contents.on('did-fail-load', () => {
        contents.loadURL(`file://${__dirname}/err.html`)
    })

    contents.loadURL(url)
    // add tray
    const appTray = new Tray(appIcon)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '关于        ',
            click() {
                showAbout()
            },
        },
        {
            label: '退出        ',
            click() {
                mainWindow.close()
            },
        },
    ])
    // Call this again for Linux because we modified the context menu
    //appIcon.setContextMenu(contextMenu);
    appTray.on('click', () => {
        mainWindow.show()
    })
    appTray.on('right-click', () => {
        appTray.popUpContextMenu(contextMenu)
    })
    //初始化更新器
    initAutoUpdater()
}

// 当全部窗口关闭时退出
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出
    // 否则绝大部分应用及其菜单栏会保持激活
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (mainWindow === null) createWindow()
})

function getUrl() {
    try {
        return require('./kis.json').serverUrl
    } catch (e) {
        console.error(e)
    }
    return null
}

function getUpdateUrl() {
    try {
        return require('./kis.json').updateUrl
    } catch (e) {
        console.error(e)
    }
    return null
}

function showAbout() {
    if (aboutWindow) {
        aboutWindow.show()
        return false
    }
    aboutWindow = new BrowserWindow({
        parent: mainWindow,
        maximizable: false,
        minimizable: false,
        resizable: false,
        modal: true,
        width: 450,
        height: 350,
        autoHideMenuBar: true,
        show: false,
        title: '关于系统',
        icon: appIcon,
        webPreferences: {
            devTools: false,
            nodeIntegration: true,
        },
    })
    const clientVersion = require('./package.json').version
    const electronVersion = process.versions.electron
    const chromeVersion = process.versions.chrome
    const nodeVersion = process.versions.node
    const data = { clientVersion, electronVersion, chromeVersion, nodeVersion }
    const querystring = require('querystring')
    const parameter = querystring.stringify(data)
    aboutWindow.loadURL(`file://${__dirname}/about.html?${parameter}`)
    aboutWindow.on('closed', () => {
        aboutWindow = null
    })
    aboutWindow.once('ready-to-show', () => {
        aboutWindow.show()
    })
}

function initAutoUpdater() {
    autoUpdater.on('error', function(error) {
        sendToAboutWindow('update-error', error)
    })
    autoUpdater.on('update-not-available', function() {
        sendToAboutWindow('update-not-available', null)
    })
    autoUpdater.on('update-downloaded', function(event1, releaseNotes, releaseName) {
        sendToAboutWindow('update-downloaded', releaseName)
    })
}

function versionCompare(v1, v2) {
    let i = 0,
        arr1 = v1.split('.'),
        arr2 = v2.split('.')
    for (;;) {
        if (arr1[i] && arr2[i]) {
            arr1[i] = parseInt(arr1[i])
            arr2[i] = parseInt(arr2[i])
            if (arr1[i] == arr2[i]) {
                i++
                continue
            } else if (arr1[i] > arr2[i]) {
                return 1
            } else {
                return -1
            }
        } else {
            // 版本不一致，无法比较，或者相同
            return 0
        }
    }
}

function sendToAboutWindow(chanel, arg) {
    try {
        aboutWindow.webContents.send(chanel, arg)
    } catch (e) {
        console.log(e)
    }
}
